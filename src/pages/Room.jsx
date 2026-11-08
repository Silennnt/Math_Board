import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Line, Rect, Image as KonvaImage } from "react-konva";
import {
	ref as dbRef,
	onValue,
	push,
	remove,
	set,
	update,
	onDisconnect,
} from "firebase/database";
import {
	ref as storageRef,
	uploadString,
	uploadBytes,
	getDownloadURL,
} from "firebase/storage";
import { database, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import "./Room.css";

const URLImage = ({
	id,
	src,
	x,
	y,
	width,
	height,
	isDraggable,
	onDragStart,
	onDragMove,
	onDragEnd,
	isSelected,
}) => {
	const [image, setImage] = useState(null);

	useEffect(() => {
		const img = new window.Image();
		img.crossOrigin = "Anonymous";

		img.onload = () => setImage(img);
		img.onerror = () => {
			const fallbackImg = new window.Image();
			fallbackImg.onload = () => setImage(fallbackImg);
			fallbackImg.src = src;
		};

		img.src = src;
	}, [src]);

	return (
		<KonvaImage
			id={id}
			image={image}
			x={x}
			y={y}
			width={width}
			height={height}
			draggable={isDraggable}
			onDragStart={(e) => onDragStart(e, id)}
			onDragMove={(e) => onDragMove(e, id)}
			onDragEnd={(e) => onDragEnd(e, id)}
			shadowColor={isSelected ? "#00e5ff" : "transparent"}
			shadowBlur={isSelected ? 10 : 0}
			onMouseEnter={(e) => {
				if (isDraggable) e.target.getStage().container().style.cursor = "move";
			}}
			onMouseLeave={(e) => {
				e.target.getStage().container().style.cursor = "default";
			}}
		/>
	);
};

const Room = () => {
	const { roomId } = useParams();
	const navigate = useNavigate();
	const { currentUser } = useAuth();

	const stageRef = useRef(null);
	const bgRectRef = useRef(null);
	const containerRef = useRef(null);

	const [lines, setLines] = useState([]);
	const [currentLine, setCurrentLine] = useState(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [isPanning, setIsPanning] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const [cursors, setCursors] = useState({});
	const lastCursorUpdate = useRef(0);

	const [sessionCreatedAt, setSessionCreatedAt] = useState(null);

	const [tool, setTool] = useState("pen");
	const [color, setColor] = useState("#00e5ff");
	const [thickness, setThickness] = useState(4);
	const [bgTheme, setBgTheme] = useState("dark");
	const [showGrid, setShowGrid] = useState(true);

	const [stageConfig, setStageConfig] = useState({ scale: 1, x: 0, y: 0 });
	const [dimensions, setDimensions] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	});

	const [selectedIds, setSelectedIds] = useState([]);
	const [selectionBox, setSelectionBox] = useState(null);
	const dragStartPositions = useRef({});

	const colors = [
		"#ffffff",
		"#94a3b8",
		"#00e5ff",
		"#3b82f6",
		"#a855f7",
		"#f472b6",
		"#ef4444",
		"#f97316",
		"#fbbf24",
		"#84cc16",
		"#22c55e",
		"#0d1320",
	];

	const gridPattern = useMemo(() => {
		const canvas = document.createElement("canvas");
		canvas.width = 50;
		canvas.height = 50;
		const ctx = canvas.getContext("2d");

		ctx.fillStyle = bgTheme === "dark" ? "#0d1320" : "#f8fafc";
		ctx.fillRect(0, 0, 50, 50);

		ctx.strokeStyle =
			bgTheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.15)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(50, 0);
		ctx.lineTo(50, 50);
		ctx.lineTo(0, 50);
		ctx.stroke();

		return canvas;
	}, [bgTheme]);

	const [images, setImages] = useState([]);

	const linesRef = useRef(lines);
	const imagesRef = useRef(images);
	const stageConfigRef = useRef(stageConfig);

	useEffect(() => {
		linesRef.current = lines;
	}, [lines]);

	useEffect(() => {
		imagesRef.current = images;
	}, [images]);

	useEffect(() => {
		stageConfigRef.current = stageConfig;
	}, [stageConfig]);

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.focus();
		}

		const handleKeyDown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "z") {
				e.preventDefault();

				const myLines = linesRef.current.filter(
					(l) => l.uid === currentUser?.uid,
				);
				const myImages = imagesRef.current.filter(
					(img) => img.uid === currentUser?.uid,
				);

				const allMyItems = [
					...myLines.map((l) => ({ ...l, type: "line" })),
					...myImages.map((img) => ({ ...img, type: "image" })),
				].filter((item) => item.timestamp);

				allMyItems.sort((a, b) => b.timestamp - a.timestamp);

				if (allMyItems.length > 0) {
					const lastItem = allMyItems[0];
					if (lastItem.type === "line") {
						remove(dbRef(database, `rooms/${roomId}/lines/${lastItem.id}`));
					} else {
						remove(dbRef(database, `rooms/${roomId}/images/${lastItem.id}`));
					}
				}
			}
		};

		const handlePaste = async (e) => {
			const clipboardData = e.clipboardData || window.clipboardData;
			if (!clipboardData) return;

			const items = clipboardData.items;
			let hasImage = false;

			for (let i = 0; i < items.length; i++) {
				if (items[i].type.indexOf("image") !== -1) {
					hasImage = true;
					const blob = items[i].getAsFile();
					if (!blob) continue;

					const localUrl = URL.createObjectURL(blob);
					const img = new window.Image();

					img.onload = async () => {
						try {
							const fileRef = storageRef(
								storage,
								`rooms/${roomId}/uploads/paste_${Date.now()}.png`,
							);
							await uploadBytes(fileRef, blob);
							const downloadUrl = await getDownloadURL(fileRef);

							const config = stageConfigRef.current;
							const x =
								(-config.x + window.innerWidth / 2 - img.width / 2) /
								config.scale;
							const y =
								(-config.y + window.innerHeight / 2 - img.height / 2) /
								config.scale;

							const imgDbRef = dbRef(database, `rooms/${roomId}/images`);
							await push(imgDbRef, {
								url: downloadUrl,
								x,
								y,
								width: img.width,
								height: img.height,
								uid: currentUser?.uid,
								timestamp: Date.now(),
							});
						} catch (error) {
						} finally {
							URL.revokeObjectURL(localUrl);
						}
					};
					img.src = localUrl;
				}
			}

			if (hasImage) {
				e.preventDefault();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("paste", handlePaste);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("paste", handlePaste);
		};
	}, [roomId, currentUser]);

	useEffect(() => {
		const handleResize = () =>
			setDimensions({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		if (!currentUser) return;

		const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
		const unsubscribeLines = onValue(linesDbRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				setLines(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
			} else {
				setLines([]);
			}
		});

		const imagesDbRef = dbRef(database, `rooms/${roomId}/images`);
		const unsubscribeImages = onValue(imagesDbRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				setImages(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
			} else {
				setImages([]);
			}
		});

		const cursorsDbRef = dbRef(database, `rooms/${roomId}/cursors`);
		const unsubscribeCursors = onValue(cursorsDbRef, (snapshot) => {
			setCursors(snapshot.val() || {});
		});

		const sessionRef = dbRef(database, `rooms/${roomId}/sessionInfo/createdAt`);
		const unsubscribeSession = onValue(sessionRef, (snapshot) => {
			setSessionCreatedAt(snapshot.val());
		});

		const myCursorRef = dbRef(
			database,
			`rooms/${roomId}/cursors/${currentUser.uid}`,
		);
		onDisconnect(myCursorRef).remove();

		return () => {
			unsubscribeLines();
			unsubscribeCursors();
			unsubscribeSession();
			unsubscribeImages();
			remove(myCursorRef).catch(() => {});
		};
	}, [roomId, currentUser]);

	const getLogicalPosition = (stage) => {
		const pos = stage.getPointerPosition();
		return {
			x: (pos.x - stageConfig.x) / stageConfig.scale,
			y: (pos.y - stageConfig.y) / stageConfig.scale,
		};
	};

	const handleWheel = (e) => {
		e.evt.preventDefault();
		const scaleBy = 1.1;
		const stage = stageRef.current;
		const oldScale = stageConfig.scale;
		const pointer = stage.getPointerPosition();

		const mousePointTo = {
			x: (pointer.x - stageConfig.x) / oldScale,
			y: (pointer.y - stageConfig.y) / oldScale,
		};

		let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
		if (newScale < 0.1) newScale = 0.1;
		if (newScale > 10) newScale = 10;

		setStageConfig({
			scale: newScale,
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		});
	};

	const handleDragStart = (e, id) => {
		let activeIds = selectedIds;
		if (!activeIds.includes(id)) {
			activeIds = [id];
			setSelectedIds(activeIds);
		}
		const positions = {};
		const stage = stageRef.current;
		activeIds.forEach((selId) => {
			const node = stage.findOne("#" + selId);
			if (node) {
				positions[selId] = { x: node.x(), y: node.y() };
			}
		});
		dragStartPositions.current = positions;
	};

	const handleDragMove = (e, id) => {
		const startPos = dragStartPositions.current[id];
		if (!startPos) return;
		const dx = e.target.x() - startPos.x;
		const dy = e.target.y() - startPos.y;

		const stage = stageRef.current;
		selectedIds.forEach((selId) => {
			if (selId !== id) {
				const node = stage.findOne("#" + selId);
				if (node && dragStartPositions.current[selId]) {
					node.x(dragStartPositions.current[selId].x + dx);
					node.y(dragStartPositions.current[selId].y + dy);
				}
			}
		});
	};

	const handleDragEnd = (e, id) => {
		const updates = {};
		const stage = stageRef.current;
		let activeIds = selectedIds;
		if (!activeIds.includes(id)) activeIds = [id];

		activeIds.forEach((selId) => {
			const node = stage.findOne("#" + selId);
			if (node) {
				const isLine = linesRef.current.some((l) => l.id === selId);
				const isImg = imagesRef.current.some((i) => i.id === selId);
				if (isLine) {
					updates[`lines/${selId}/x`] = node.x();
					updates[`lines/${selId}/y`] = node.y();
				} else if (isImg) {
					updates[`images/${selId}/x`] = node.x();
					updates[`images/${selId}/y`] = node.y();
				}
			}
		});

		if (Object.keys(updates).length > 0) {
			update(dbRef(database, `rooms/${roomId}`), updates).catch(() => {});
		}
	};

	const handleMouseDown = (e) => {
		if (e.evt.button === 2 || e.evt.button === 1) {
			setIsPanning(true);
			return;
		}

		if (tool !== "select") {
			setSelectedIds([]);
		}

		if (tool === "select") {
			const clickedOnEmpty =
				e.target === e.target.getStage() || e.target === bgRectRef.current;
			if (clickedOnEmpty) {
				const pos = getLogicalPosition(e.target.getStage());
				setSelectionBox({
					startX: pos.x,
					startY: pos.y,
					x: pos.x,
					y: pos.y,
					width: 0,
					height: 0,
				});
				setSelectedIds([]);
			} else {
				const id = e.target.id();
				if (id && !selectedIds.includes(id)) {
					setSelectedIds([id]);
				}
			}
			return;
		}

		if (tool === "eraser-object") return;

		if (!sessionCreatedAt) {
			const now = new Date().toISOString();
			set(dbRef(database, `rooms/${roomId}/sessionInfo/createdAt`), now);
			setSessionCreatedAt(now);
		}

		setIsDrawing(true);
		const pos = getLogicalPosition(e.target.getStage());
		setCurrentLine({ tool, color, thickness, points: [pos.x, pos.y] });
	};

	const handleMouseMove = (e) => {
		const stage = e.target.getStage();
		const logicalPos = getLogicalPosition(stage);

		const now = Date.now();
		if (now - lastCursorUpdate.current > 50 && currentUser) {
			const myCursorRef = dbRef(
				database,
				`rooms/${roomId}/cursors/${currentUser.uid}`,
			);
			set(myCursorRef, {
				x: logicalPos.x,
				y: logicalPos.y,
				email: currentUser.email,
			}).catch(() => {});
			lastCursorUpdate.current = now;
		}

		if (isPanning) {
			setStageConfig((prev) => ({
				...prev,
				x: prev.x + e.evt.movementX,
				y: prev.y + e.evt.movementY,
			}));
			return;
		}

		if (tool === "select" && selectionBox) {
			setSelectionBox((prev) => ({
				...prev,
				x: Math.min(prev.startX, logicalPos.x),
				y: Math.min(prev.startY, logicalPos.y),
				width: Math.abs(logicalPos.x - prev.startX),
				height: Math.abs(logicalPos.y - prev.startY),
			}));
			return;
		}

		if (
			!isDrawing ||
			tool === "eraser-object" ||
			tool === "select" ||
			!currentLine
		)
			return;

		setCurrentLine((prev) => ({
			...prev,
			points: prev.points.concat([logicalPos.x, logicalPos.y]),
		}));
	};

	const handleMouseUp = () => {
		if (isPanning) {
			setIsPanning(false);
			return;
		}

		if (tool === "select" && selectionBox) {
			const box = selectionBox;
			const newSelected = [];

			images.forEach((img) => {
				if (
					!(
						img.x > box.x + box.width ||
						img.x + img.width < box.x ||
						img.y > box.y + box.height ||
						img.y + img.height < box.y
					)
				) {
					newSelected.push(img.id);
				}
			});

			lines.forEach((line) => {
				const lx = line.x || 0;
				const ly = line.y || 0;
				let hasPointInside = false;
				for (let i = 0; i < line.points.length; i += 2) {
					const px = line.points[i] + lx;
					const py = line.points[i + 1] + ly;
					if (
						px >= box.x &&
						px <= box.x + box.width &&
						py >= box.y &&
						py <= box.y + box.height
					) {
						hasPointInside = true;
						break;
					}
				}
				if (hasPointInside) newSelected.push(line.id);
			});

			setSelectedIds(newSelected);
			setSelectionBox(null);
			return;
		}

		setIsDrawing(false);
		if (currentLine) {
			const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
			push(linesDbRef, {
				...currentLine,
				uid: currentUser.uid,
				timestamp: Date.now(),
			}).catch(() => {});
			setCurrentLine(null);
		}
	};

	const handleMouseLeave = () => {
		if (currentUser) {
			const myCursorRef = dbRef(
				database,
				`rooms/${roomId}/cursors/${currentUser.uid}`,
			);
			remove(myCursorRef).catch(() => {});
		}
	};

	const handleContextMenu = (e) => e.preventDefault();

	const eraseLine = (id) => {
		const lineRef = dbRef(database, `rooms/${roomId}/lines/${id}`);
		remove(lineRef).catch(() => {});
	};

	const handleClearBoard = () => {
		if (
			window.confirm(
				"UWAGA: To trwale usunie wszystkie rysunki i zrzuty z obecnego cyklu (dla Ciebie i ucznia). Upewnij się, że wcześniej wykonałeś zrzut. Kontynuować?",
			)
		) {
			remove(dbRef(database, `rooms/${roomId}/lines`));
			remove(dbRef(database, `rooms/${roomId}/images`));
			remove(dbRef(database, `rooms/${roomId}/sessionInfo`));
		}
	};

	const handleSaveScreenshot = async () => {
		if (!stageRef.current) return;
		setIsSaving(true);

		try {
			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;

			lines.forEach((line) => {
				const offsetX = line.x || 0;
				const offsetY = line.y || 0;
				for (let i = 0; i < line.points.length; i += 2) {
					const x = line.points[i] + offsetX;
					const y = line.points[i + 1] + offsetY;
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
			});

			images.forEach((img) => {
				if (img.x < minX) minX = img.x;
				if (img.x + img.width > maxX) maxX = img.x + img.width;
				if (img.y < minY) minY = img.y;
				if (img.y + img.height > maxY) maxY = img.y + img.height;
			});

			if (minX === Infinity) {
				minX = 0;
				minY = 0;
				maxX = window.innerWidth;
				maxY = window.innerHeight;
			}

			const padding = 70;
			minX -= padding;
			minY -= padding;
			maxX += padding;
			maxY += padding;
			const bWidth = maxX - minX;
			const bHeight = maxY - minY;

			const stage = stageRef.current;
			const bgRect = bgRectRef.current;

			const oldScaleX = stage.scaleX();
			const oldScaleY = stage.scaleY();
			const oldX = stage.x();
			const oldY = stage.y();
			const oldBgAttrs = { ...bgRect.attrs };

			stage.scale({ x: 1, y: 1 });
			stage.position({ x: 0, y: 0 });
			bgRect.setAttrs({
				x: minX,
				y: minY,
				width: bWidth,
				height: bHeight,
				fillPatternOffsetX: minX,
				fillPatternOffsetY: minY,
			});

			stage.draw();

			const dataUrl = stage.toDataURL({
				x: minX,
				y: minY,
				width: bWidth,
				height: bHeight,
				pixelRatio: 2,
			});

			stage.scale({ x: oldScaleX, y: oldScaleY });
			stage.position({ x: oldX, y: oldY });
			bgRect.setAttrs(oldBgAttrs);
			stage.draw();

			const timestamp = Date.now();
			const imageRef = storageRef(
				storage,
				`rooms/${roomId}/screenshots/board_${timestamp}.png`,
			);
			await uploadString(imageRef, dataUrl, "data_url");
			const downloadUrl = await getDownloadURL(imageRef);

			const screenshotsDbRef = dbRef(database, `rooms/${roomId}/screenshots`);
			const lessonDate = sessionCreatedAt || new Date().toISOString();

			await push(screenshotsDbRef, {
				url: downloadUrl,
				createdAt: lessonDate,
			});

			alert(
				"Pomyślnie wygenerowano i zapisano pełny zrzut tablicy w historii ucznia.",
			);
		} catch (error) {
			alert("Wystąpił błąd podczas generowania zrzutu ekranu.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			ref={containerRef}
			className="room-container"
			onContextMenu={handleContextMenu}
			style={{ backgroundColor: bgTheme === "dark" ? "#0d1320" : "#f8fafc" }}
			tabIndex={0}
		>
			<aside className={`room-toolbar left-toolbar theme-${bgTheme}`}>
				<div className="toolbar-section">
					<button
						className="btn-leave"
						onClick={() => navigate("/dashboard")}
						title="Wróć do panelu (bez usuwania tablicy)"
					>
						⏴ Wróć
					</button>
				</div>

				<div className="toolbar-section">
					<button
						className={`tool-btn ${tool === "select" ? "active" : ""}`}
						onClick={() => setTool("select")}
						title="Przesuwaj wklejone obrazy i rysunki"
					>
						Wybierz
					</button>
					<button
						className={`tool-btn ${tool === "pen" ? "active" : ""}`}
						onClick={() => setTool("pen")}
					>
						Rysuj
					</button>
					<button
						className={`tool-btn ${tool === "eraser-pixel" ? "active" : ""}`}
						onClick={() => setTool("eraser-pixel")}
						title="Usuwaj pociągnięciami"
					>
						Gumka ślad
					</button>
					<button
						className={`tool-btn ${tool === "eraser-object" ? "active" : ""}`}
						onClick={() => setTool("eraser-object")}
						title="Usuwa całe elementy"
					>
						Gumka obiekt
					</button>
				</div>

				<div
					className={`toolbar-section ${tool !== "pen" ? "disabled-ui" : ""}`}
				>
					<div className="color-grid">
						{colors.map((c) => (
							<div
								key={c}
								className={`color-swatch ${color === c ? "active" : ""}`}
								style={{ backgroundColor: c }}
								onClick={() => setColor(c)}
								title={c}
							/>
						))}
					</div>
				</div>

				<div
					className={`toolbar-section ${tool === "eraser-object" || tool === "select" ? "disabled-ui" : ""}`}
				>
					<div className="thickness-picker">
						<span className="tool-label">Grubość</span>
						<input
							type="range"
							min="2"
							max="40"
							value={thickness}
							onChange={(e) => setThickness(Number(e.target.value))}
							className="vertical-slider"
						/>
					</div>
				</div>

				<div className="toolbar-section">
					<span className="tool-label">Tło</span>
					<div className="bg-options">
						<button
							className={`tool-btn bg-toggle ${bgTheme === "dark" ? "active" : ""}`}
							onClick={() => setBgTheme("dark")}
						>
							Ciemne
						</button>
						<button
							className={`tool-btn bg-toggle ${bgTheme === "light" ? "active" : ""}`}
							onClick={() => setBgTheme("light")}
						>
							Jasne
						</button>
					</div>
					<button
						className={`tool-btn bg-toggle ${showGrid ? "active" : ""}`}
						onClick={() => setShowGrid(!showGrid)}
					>
						{showGrid ? "Wyłącz siatkę" : "Włącz siatkę"}
					</button>
				</div>

				<div className="toolbar-section no-border">
					<button
						className="btn-save"
						onClick={handleSaveScreenshot}
						disabled={isSaving}
						title="Generuje zrzut ekranu całego materiału, ale nie usuwa tablicy"
					>
						{isSaving ? "⏳" : "Zrób Zrzut"}
					</button>
					<button
						className="btn-clear"
						onClick={handleClearBoard}
						title="Usuwa bieżący materiał, robiąc miejsce na nowy tydzień"
					>
						Wyczyść
					</button>
				</div>
			</aside>

			<div className={`canvas-wrapper ${isPanning ? "panning" : ""}`}>
				<div className="remote-cursors-overlay">
					{Object.entries(cursors).map(([uid, cursorData]) => {
						if (uid === currentUser?.uid) return null;
						const screenX = cursorData.x * stageConfig.scale + stageConfig.x;
						const screenY = cursorData.y * stageConfig.scale + stageConfig.y;

						return (
							<div
								key={uid}
								className="remote-cursor"
								style={{ transform: `translate(${screenX}px, ${screenY}px)` }}
							>
								<svg
									width="26"
									height="26"
									viewBox="0 0 24 24"
									fill={bgTheme === "dark" ? "#00e5ff" : "#3b82f6"}
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42c.45 0 .67-.54.35-.85L5.5 3.21z"
										stroke="white"
										strokeWidth="1.5"
										strokeLinejoin="round"
									/>
								</svg>
								<div className={`remote-cursor-label label-theme-${bgTheme}`}>
									{cursorData.email}
								</div>
							</div>
						);
					})}
				</div>

				<Stage
					ref={stageRef}
					width={dimensions.width}
					height={dimensions.height}
					scaleX={stageConfig.scale}
					scaleY={stageConfig.scale}
					x={stageConfig.x}
					y={stageConfig.y}
					onWheel={handleWheel}
					onMouseDown={handleMouseDown}
					onMousemove={handleMouseMove}
					onMouseup={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onTouchStart={handleMouseDown}
					onTouchMove={handleMouseMove}
					onTouchEnd={handleMouseUp}
				>
					<Layer>
						<Rect
							ref={bgRectRef}
							x={-stageConfig.x / stageConfig.scale}
							y={-stageConfig.y / stageConfig.scale}
							width={dimensions.width / stageConfig.scale}
							height={dimensions.height / stageConfig.scale}
							fillPatternImage={showGrid ? gridPattern : null}
							fill={
								!showGrid ? (bgTheme === "dark" ? "#0d1320" : "#f8fafc") : null
							}
							fillPatternOffsetX={-stageConfig.x / stageConfig.scale}
							fillPatternOffsetY={-stageConfig.y / stageConfig.scale}
						/>
					</Layer>

					<Layer>
						{images.map((img) => (
							<URLImage
								key={img.id}
								id={img.id}
								src={img.url}
								x={img.x}
								y={img.y}
								width={img.width}
								height={img.height}
								isDraggable={tool === "select"}
								onDragStart={handleDragStart}
								onDragMove={handleDragMove}
								onDragEnd={handleDragEnd}
								isSelected={selectedIds.includes(img.id)}
							/>
						))}
						{lines.map((line) => (
							<Line
								key={line.id}
								id={line.id}
								x={line.x || 0}
								y={line.y || 0}
								points={line.points || []}
								stroke={line.color}
								strokeWidth={line.thickness || 4}
								tension={0.5}
								lineCap="round"
								lineJoin="round"
								draggable={tool === "select"}
								onDragStart={(e) => handleDragStart(e, line.id)}
								onDragMove={(e) => handleDragMove(e, line.id)}
								onDragEnd={(e) => handleDragEnd(e, line.id)}
								shadowColor={
									selectedIds.includes(line.id) ? "#00e5ff" : "transparent"
								}
								shadowBlur={selectedIds.includes(line.id) ? 10 : 0}
								hitStrokeWidth={Math.max(line.thickness || 4, 15)}
								globalCompositeOperation={
									line.tool === "eraser-pixel"
										? "destination-out"
										: "source-over"
								}
								onMouseDown={(e) => {
									if (tool === "eraser-object") {
										e.cancelBubble = true;
										eraseLine(line.id);
									}
								}}
								onMouseEnter={(e) => {
									if (tool === "select") {
										e.target.getStage().container().style.cursor = "move";
									}
									if (tool === "eraser-object" && e.evt.buttons === 1) {
										eraseLine(line.id);
									}
								}}
								onMouseLeave={(e) => {
									if (tool === "select") {
										e.target.getStage().container().style.cursor = "default";
									}
								}}
							/>
						))}

						{currentLine && (
							<Line
								points={currentLine.points || []}
								stroke={currentLine.color}
								strokeWidth={currentLine.thickness || 4}
								tension={0.5}
								lineCap="round"
								lineJoin="round"
								globalCompositeOperation={
									currentLine.tool === "eraser-pixel"
										? "destination-out"
										: "source-over"
								}
							/>
						)}

						{selectionBox && (
							<Rect
								x={selectionBox.x}
								y={selectionBox.y}
								width={selectionBox.width}
								height={selectionBox.height}
								fill="rgba(0, 229, 255, 0.2)"
								stroke="#00e5ff"
								strokeWidth={1 / stageConfig.scale}
								dash={[4 / stageConfig.scale, 4 / stageConfig.scale]}
							/>
						)}
					</Layer>
				</Stage>
			</div>
		</div>
	);
};

export default Room;
