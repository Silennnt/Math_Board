import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	Stage,
	Layer,
	Line,
	Rect,
	Image as KonvaImage,
	Transformer,
	Path,
} from "react-konva";
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
const SHAPE_PATHS = {
	square: "M0 0 H100 V100 H0 Z",
	rectangle: "M0 25 H100 V75 H0 Z",
	rhombus: "M50 0 L100 50 L50 100 L0 50 Z",
	trapezoid: "M20 0 H80 L100 100 H0 Z",
	trapezoidRight: "M0 0 H70 L100 100 H0 Z",
	triangleRight: "M0 0 L0 100 L100 100 Z",
	triangleEquilateral: "M50 0 L100 100 L0 100 Z",
	hexagon: "M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z",
	circle: "M0,50 a50,50 0 1,0 100,0 a50,50 0 1,0 -100,0",
	line: "M0 50 L100 50",
	dashedLine: "M0 50 L100 50",

	cube: "M0 30 L70 30 L70 100 L0 100 Z M0 30 L30 0 L100 0 L70 30 M100 0 L100 70 L70 100",
	cuboid:
		"M0 40 L70 40 L70 90 L0 90 Z M0 40 L30 10 L100 10 L70 40 M100 10 L100 60 L70 90",
	prismTriangular:
		"M30 0 L70 0 L50 30 Z M30 60 L70 60 L50 90 Z M30 0 L30 60 M70 0 L70 60 M50 30 L50 90",
	prismHexagonal:
		"M30 0 L70 0 L100 20 L70 40 L30 40 L0 20 Z M30 60 L70 60 L100 80 L70 100 L30 100 L0 80 Z M30 0 L30 60 M70 0 L70 60 M100 20 L100 80 M70 40 L70 100 M30 40 L30 100 M0 20 L0 80",
	cylinder:
		"M0 20 C0 0 100 0 100 20 C100 40 0 40 0 20 M0 20 L0 80 C0 100 100 100 100 80 L100 20",
	cone: "M50 0 L0 80 C0 100 100 100 100 80 Z M0 80 C0 60 100 60 100 80",
	pyramid: "M50 0 L0 80 L100 80 Z M50 0 L40 100 L100 80 M0 80 L40 100",
	pyramidTriangular:
		"M50 0 L20 70 L80 70 Z M50 0 L50 100 L80 70 M20 70 L50 100",
	pyramidHexagonal:
		"M30 70 L70 70 L100 85 L70 100 L30 100 L0 85 Z M50 0 L30 70 M50 0 L70 70 M50 0 L100 85 M50 0 L70 100 M50 0 L30 100 M50 0 L0 85",
};

const URLImage = ({
	id,
	src,
	x,
	y,
	width,
	height,
	scaleX = 1,
	scaleY = 1,
	rotation = 0,
	isDraggable,
	onDragStart,
	onDragMove,
	onDragEnd,
	onTransformEnd,
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
			name="board-item"
			image={image}
			x={x}
			y={y}
			scaleX={scaleX}
			scaleY={scaleY}
			rotation={rotation}
			width={width}
			height={height}
			draggable={isDraggable}
			onDragStart={(e) => onDragStart(e, id)}
			onDragMove={(e) => onDragMove(e, id)}
			onDragEnd={(e) => onDragEnd(e, id)}
			onTransformEnd={(e) => onTransformEnd(e, id)}
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
	const transformerRef = useRef(null);

	const [lines, setLines] = useState([]);
	const [currentLine, setCurrentLine] = useState(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [isPanning, setIsPanning] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const [cursors, setCursors] = useState({});
	const lastCursorUpdate = useRef(0);

	const [sessionCreatedAt, setSessionCreatedAt] = useState(null);

	const [tool, setTool] = useState("pen");
	const [showShapeMenu, setShowShapeMenu] = useState(false);
	const [shapeType, setShapeType] = useState("square");
	useEffect(() => {
		if (tool !== "shape") {
			setShowShapeMenu(false);
		}
	}, [tool]);
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
	const isPanningMoved = useRef(false);
	const [contextMenu, setContextMenu] = useState(null);
	const internalClipboard = useRef({
		lines: [],
		images: [],
		center: { x: 0, y: 0 },
	});
	const globalMousePos = useRef({
		x: window.innerWidth / 2,
		y: window.innerHeight / 2,
	});

	const velocity = useRef({ x: 0, y: 0, time: 0 });
	const lastPanPosition = useRef({ x: 0, y: 0, time: 0 });
	const animationRef = useRef(null);

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

	const myNameRef = useRef(
		currentUser?.displayName || currentUser?.email?.split("@")[0] || "Uczeń",
	);

	useEffect(() => {
		if (!currentUser) return;
		const userProfileRef = dbRef(database, `users/${currentUser.uid}`);
		const unsubscribe = onValue(userProfileRef, (snapshot) => {
			if (snapshot.exists()) {
				const data = snapshot.val();
				if (data.name) {
					myNameRef.current = data.name;
				}
			}
		});
		return () => unsubscribe();
	}, [currentUser]);

	const handleColorClick = (newColor) => {
		setColor(newColor);
		if (selectedIds.length > 0) {
			const updates = {};
			selectedIds.forEach((id) => {
				if (linesRef.current.some((l) => l.id === id)) {
					updates[`lines/${id}/color`] = newColor;
				}
			});
			if (Object.keys(updates).length > 0) {
				update(dbRef(database, `rooms/${roomId}`), updates).catch(() => {});
			}
		}
	};

	const handleThicknessChange = (e) => {
		const newThick = Number(e.target.value);
		setThickness(newThick);
		if (selectedIds.length > 0) {
			const updates = {};
			selectedIds.forEach((id) => {
				if (linesRef.current.some((l) => l.id === id)) {
					updates[`lines/${id}/thickness`] = newThick;
				}
			});
			if (Object.keys(updates).length > 0) {
				update(dbRef(database, `rooms/${roomId}`), updates).catch(() => {});
			}
		}
	};
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
		const handleGlobalMouseMove = (e) => {
			globalMousePos.current = { x: e.clientX, y: e.clientY };
		};
		window.addEventListener("mousemove", handleGlobalMouseMove);
		return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
	}, []);

	useEffect(() => {
		if (tool === "select" && transformerRef.current) {
			const stage = stageRef.current;
			const nodes = selectedIds
				.map((id) => stage.findOne("#" + id))
				.filter(Boolean);
			transformerRef.current.nodes(nodes);
			transformerRef.current.getLayer().batchDraw();
		} else if (transformerRef.current) {
			transformerRef.current.nodes([]);
		}
	}, [selectedIds, tool, lines, images]);

	const handleCopy = () => {
		if (selectedIds.length === 0) return;
		const copiedLines = linesRef.current.filter((l) =>
			selectedIds.includes(l.id),
		);
		const copiedImages = imagesRef.current.filter((i) =>
			selectedIds.includes(i.id),
		);

		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		if (stageRef.current) {
			const stage = stageRef.current;
			selectedIds.forEach((id) => {
				const node = stage.findOne("#" + id);
				if (node) {
					const rect = node.getClientRect({ skipTransform: true });
					if (rect.x < minX) minX = rect.x;
					if (rect.y < minY) minY = rect.y;
					if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
					if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
				}
			});
		}

		const cx = minX === Infinity ? 0 : (minX + maxX) / 2;
		const cy = minY === Infinity ? 0 : (minY + maxY) / 2;

		internalClipboard.current = {
			lines: copiedLines,
			images: copiedImages,
			center: { x: cx, y: cy },
		};
		setContextMenu(null);
	};

	const handleInternalPaste = (targetPos = null) => {
		const {
			lines: cLines,
			images: cImages,
			center,
		} = internalClipboard.current;
		if (cLines.length === 0 && cImages.length === 0) return;

		let logicalX, logicalY;
		if (targetPos) {
			logicalX = targetPos.x;
			logicalY = targetPos.y;
		} else {
			const config = stageConfigRef.current;
			let containerRect = { left: 0, top: 0 };
			if (containerRef.current) {
				containerRect = containerRef.current.getBoundingClientRect();
			}
			const pointerX = globalMousePos.current.x - containerRect.left;
			const pointerY = globalMousePos.current.y - containerRect.top;
			logicalX = (pointerX - config.x) / config.scale;
			logicalY = (pointerY - config.y) / config.scale;
		}

		const dx = logicalX - center.x;
		const dy = logicalY - center.y;
		const newSelectedIds = [];

		const batchTimestamp = Date.now();

		cLines.forEach((l) => {
			const newLine = {
				...l,
				uid: currentUser.uid,
				timestamp: batchTimestamp,
				x: (l.x || 0) + dx,
				y: (l.y || 0) + dy,
			};
			delete newLine.id;
			const newRef = push(dbRef(database, `rooms/${roomId}/lines`), newLine);
			newSelectedIds.push(newRef.key);
		});

		cImages.forEach((img) => {
			const newImg = {
				...img,
				uid: currentUser.uid,
				timestamp: batchTimestamp,
				x: img.x + dx,
				y: img.y + dy,
			};
			delete newImg.id;
			const newRef = push(dbRef(database, `rooms/${roomId}/images`), newImg);
			newSelectedIds.push(newRef.key);
		});

		setSelectedIds(newSelectedIds);
		setContextMenu(null);
	};

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.focus();
		}

		const handleKeyDown = (e) => {
			if (e.ctrlKey || e.metaKey) {
				const key = e.key.toLowerCase();
				if (key === "z") {
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
						const targetTimestamp = allMyItems[0].timestamp;
						const itemsToRemove = allMyItems.filter(
							(item) => item.timestamp === targetTimestamp,
						);

						itemsToRemove.forEach((item) => {
							if (item.type === "line") {
								remove(dbRef(database, `rooms/${roomId}/lines/${item.id}`));
							} else {
								remove(dbRef(database, `rooms/${roomId}/images/${item.id}`));
							}
						});
					}
				} else if (key === "c") {
					e.preventDefault();
					handleCopy();
				} else if (key === "v") {
					handleInternalPaste();
				}
			} else if (e.key === "Delete" || e.key === "Backspace") {
				handleDeleteSelected();
			}
		};

		const handlePaste = async (e) => {
			const clipboardData = e.clipboardData || window.clipboardData;
			if (!clipboardData) return;

			const items = clipboardData.items;
			let hasImage = false;
			const batchTimestamp = Date.now();

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
							let containerRect = { left: 0, top: 0 };
							if (containerRef.current) {
								containerRect = containerRef.current.getBoundingClientRect();
							}
							const pointerX = globalMousePos.current.x - containerRect.left;
							const pointerY = globalMousePos.current.y - containerRect.top;

							const x = (pointerX - config.x) / config.scale - img.width / 2;
							const y = (pointerY - config.y) / config.scale - img.height / 2;

							const imgDbRef = dbRef(database, `rooms/${roomId}/images`);
							await push(imgDbRef, {
								url: downloadUrl,
								x,
								y,
								scaleX: 1,
								scaleY: 1,
								rotation: 0,
								width: img.width,
								height: img.height,
								uid: currentUser?.uid,
								timestamp: batchTimestamp,
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
	}, [roomId, currentUser, selectedIds]);

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
		if (contextMenu) setContextMenu(null);
		if (animationRef.current) cancelAnimationFrame(animationRef.current);

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
		if (contextMenu) setContextMenu(null);
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

	const handleTransformEnd = (e, id) => {
		const node = e.target;
		const updates = {};
		const isLine = linesRef.current.some((l) => l.id === id);
		const isImg = imagesRef.current.some((i) => i.id === id);

		if (isLine) {
			updates[`lines/${id}/x`] = node.x();
			updates[`lines/${id}/y`] = node.y();
			updates[`lines/${id}/scaleX`] = node.scaleX();
			updates[`lines/${id}/scaleY`] = node.scaleY();
			updates[`lines/${id}/rotation`] = node.rotation();
		} else if (isImg) {
			updates[`images/${id}/x`] = node.x();
			updates[`images/${id}/y`] = node.y();
			updates[`images/${id}/scaleX`] = node.scaleX();
			updates[`images/${id}/scaleY`] = node.scaleY();
			updates[`images/${id}/rotation`] = node.rotation();
		}

		if (Object.keys(updates).length > 0) {
			update(dbRef(database, `rooms/${roomId}`), updates).catch(() => {});
		}
	};

	const handleMouseDown = (e) => {
		isPanningMoved.current = false;
		if (contextMenu) setContextMenu(null);
		if (animationRef.current) cancelAnimationFrame(animationRef.current);

		if (e.evt.button === 2 || e.evt.button === 1) {
			setIsPanning(true);
			lastPanPosition.current = {
				x: e.evt.clientX,
				y: e.evt.clientY,
				time: Date.now(),
			};
			velocity.current = { x: 0, y: 0, time: 0 };
			return;
		}

		const clickedOnTransformer =
			e.target.getParent()?.className === "Transformer";
		if (clickedOnTransformer) return;

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
				if (id) {
					if (!e.evt.shiftKey && !selectedIds.includes(id)) {
						setSelectedIds([id]);
					} else if (e.evt.shiftKey) {
						if (selectedIds.includes(id)) {
							setSelectedIds(selectedIds.filter((selId) => selId !== id));
						} else {
							setSelectedIds([...selectedIds, id]);
						}
					}
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

		if (tool === "shape") {
			setCurrentLine({
				tool: "shape",
				shapeType: shapeType,
				color: color,
				thickness: thickness,
				startX: pos.x,
				startY: pos.y,
				x: pos.x,
				y: pos.y,
				width: 0,
				height: 0,
			});
			setShowShapeMenu(false);
			return;
		}

		setCurrentLine({
			tool,
			color,
			thickness,
			points: [pos.x, pos.y, pos.x, pos.y + 0.01],
		});
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
				name: myNameRef.current,
			}).catch(() => {});
			lastCursorUpdate.current = now;
		}

		if (isPanning) {
			isPanningMoved.current = true;
			const dt = now - lastPanPosition.current.time;

			if (dt > 0) {
				velocity.current = {
					x: (e.evt.clientX - lastPanPosition.current.x) / dt,
					y: (e.evt.clientY - lastPanPosition.current.y) / dt,
					time: now,
				};
			}

			lastPanPosition.current = {
				x: e.evt.clientX,
				y: e.evt.clientY,
				time: now,
			};

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

		if (currentLine.tool === "shape") {
			if (
				currentLine.shapeType === "line" ||
				currentLine.shapeType === "dashedLine"
			) {
				setCurrentLine((prev) => ({
					...prev,
					width: logicalPos.x - prev.startX,
					height: logicalPos.y - prev.startY,
				}));
			} else {
				setCurrentLine((prev) => ({
					...prev,
					x: Math.min(prev.startX, logicalPos.x),
					y: Math.min(prev.startY, logicalPos.y),
					width: Math.abs(logicalPos.x - prev.startX),
					height: Math.abs(logicalPos.y - prev.startY),
				}));
			}
			return;
		}

		setCurrentLine((prev) => {
			const pts = prev.points;
			if (pts.length >= 2) {
				const lastX = pts[pts.length - 2];
				const lastY = pts[pts.length - 1];
				const dx = logicalPos.x - lastX;
				const dy = logicalPos.y - lastY;

				const distSq = dx * dx + dy * dy;
				const threshold = 49 / (stageConfig.scale * stageConfig.scale);

				if (distSq < threshold) {
					return prev;
				}
			}
			const optimizedX = Math.round(logicalPos.x * 10) / 10;
			const optimizedY = Math.round(logicalPos.y * 10) / 10;
			return {
				...prev,
				points: pts.concat([logicalPos.x, logicalPos.y]),
			};
		});
	};

	const handleMouseUp = () => {
		if (isPanning) {
			setIsPanning(false);

			const now = Date.now();
			if (now - velocity.current.time > 50) return;

			let vx = velocity.current.x * 16.6;
			let vy = velocity.current.y * 16.6;
			const friction = 0.92;

			const animateInertia = () => {
				vx *= friction;
				vy *= friction;

				if (Math.abs(vx) > 0.2 || Math.abs(vy) > 0.2) {
					setStageConfig((prev) => ({
						...prev,
						x: prev.x + vx,
						y: prev.y + vy,
					}));
					animationRef.current = requestAnimationFrame(animateInertia);
				}
			};

			if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
				animationRef.current = requestAnimationFrame(animateInertia);
			}
			return;
		}

		if (tool === "select" && selectionBox) {
			const stage = stageRef.current;

			const boxRect = {
				x: selectionBox.x * stageConfig.scale + stageConfig.x,
				y: selectionBox.y * stageConfig.scale + stageConfig.y,
				width: selectionBox.width * stageConfig.scale,
				height: selectionBox.height * stageConfig.scale,
			};

			const items = stage.find(".board-item");
			const newSelected = [];

			items.forEach((item) => {
				const itemRect = item.getClientRect({ skipTransform: false });
				if (
					!(
						itemRect.x > boxRect.x + boxRect.width ||
						itemRect.x + itemRect.width < boxRect.x ||
						itemRect.y > boxRect.y + boxRect.height ||
						itemRect.y + itemRect.height < boxRect.y
					)
				) {
					newSelected.push(item.id());
				}
			});

			setSelectedIds(newSelected);
			setSelectionBox(null);
			return;
		}

		setIsDrawing(false);

		if (currentLine && currentLine.tool === "shape") {
			let finalShape = {
				...currentLine,
				uid: currentUser.uid,
				timestamp: Date.now(),
				rotation: 0,
			};

			if (
				finalShape.shapeType === "line" ||
				finalShape.shapeType === "dashedLine"
			) {
				if (Math.abs(finalShape.width) < 5 && Math.abs(finalShape.height) < 5) {
					finalShape.width = 100;
					finalShape.height = 0;
				}
				finalShape.scaleX = 1;
				finalShape.scaleY = 1;
			} else {
				if (Math.abs(finalShape.width) < 5 && Math.abs(finalShape.height) < 5) {
					finalShape.x = currentLine.startX - 50;
					finalShape.y = currentLine.startY - 50;
					finalShape.scaleX = 1;
					finalShape.scaleY = 1;
				} else {
					finalShape.scaleX = finalShape.width / 100;
					finalShape.scaleY = finalShape.height / 100;
				}
				delete finalShape.width;
				delete finalShape.height;
			}

			delete finalShape.startX;
			delete finalShape.startY;

			push(dbRef(database, `rooms/${roomId}/lines`), finalShape).catch(
				() => {},
			);
			setCurrentLine(null);
			setTool("select");
			return;
		}

		if (currentLine) {
			const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
			push(linesDbRef, {
				...currentLine,
				uid: currentUser.uid,
				timestamp: Date.now(),
				scaleX: 1,
				scaleY: 1,
				rotation: 0,
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

	const handleContextMenu = (e) => {
		e.evt.preventDefault();
		if (isPanningMoved.current) {
			isPanningMoved.current = false;
			return;
		}

		const target = e.target;
		const isCanvas =
			target === target.getStage() || target === bgRectRef.current;
		const id = target.id();

		let currentSelection = selectedIds;

		if (!isCanvas && id && !selectedIds.includes(id)) {
			currentSelection = [id];
			setSelectedIds(currentSelection);
		}

		const hasClipboardData =
			internalClipboard.current.lines.length > 0 ||
			internalClipboard.current.images.length > 0;

		const stagePos = getLogicalPosition(e.target.getStage());

		setContextMenu({
			x: e.evt.clientX,
			y: e.evt.clientY,
			logicalPos: stagePos,
			hasSelection: currentSelection.length > 0,
			hasClipboardData: hasClipboardData,
		});
	};

	const handleDeleteSelected = () => {
		selectedIds.forEach((id) => {
			const isLine = linesRef.current.some((l) => l.id === id);
			const isImg = imagesRef.current.some((i) => i.id === id);
			if (isLine) {
				remove(dbRef(database, `rooms/${roomId}/lines/${id}`));
			} else if (isImg) {
				remove(dbRef(database, `rooms/${roomId}/images/${id}`));
			}
		});
		setSelectedIds([]);
		setContextMenu(null);
	};

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
			const stage = stageRef.current;
			const bgRect = bgRectRef.current;

			const oldScaleX = stage.scaleX();
			const oldScaleY = stage.scaleY();
			const oldX = stage.x();
			const oldY = stage.y();
			const oldBgAttrs = { ...bgRect.attrs };

			stage.scale({ x: 1, y: 1 });
			stage.position({ x: 0, y: 0 });
			stage.draw();

			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;

			const items = stage.find(".board-item");

			items.forEach((item) => {
				const rect = item.getClientRect({ skipTransform: false });
				if (rect.width > 0 && rect.height > 0) {
					if (rect.x < minX) minX = rect.x;
					if (rect.y < minY) minY = rect.y;
					if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
					if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
				}
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

				<div className="toolbar-section tools-grid">
					<button
						className={`tool-icon-btn ${tool === "select" ? "active" : ""}`}
						onClick={() => setTool("select")}
						title="Wybierz i przesuwaj"
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
						</svg>
					</button>
					<button
						className={`tool-icon-btn ${tool === "pen" ? "active" : ""}`}
						onClick={() => setTool("pen")}
						title="Ołówek"
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M12 20h9" />
							<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
						</svg>
					</button>
					<button
						className={`tool-icon-btn ${tool === "highlighter" ? "active" : ""}`}
						onClick={() => setTool("highlighter")}
						title="Flamaster (Podkreślacz)"
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M9 11l-6 6v3h9l3-3" />
							<path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
						</svg>
					</button>
					<button
						className={`tool-icon-btn ${tool === "shape" ? "active" : ""}`}
						onClick={() => setShowShapeMenu(!showShapeMenu)}
						title="Figury geometryczne 2D i 3D"
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
						</svg>
					</button>
					<button
						className={`tool-icon-btn ${tool === "eraser-pixel" ? "active" : ""}`}
						onClick={() => setTool("eraser-pixel")}
						title="Gumka (Ślad)"
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M20 20H7L3 16c-.5-.5-.5-1.5 0-2l10-10c.5-.5 1.5-.5 2 0l5 5c.5.5.5 1.5 0 2L11 20" />
							<path d="M16 15l-6 6" />
						</svg>
					</button>
					<button
						className={`tool-icon-btn ${tool === "eraser-object" ? "active" : ""}`}
						onClick={() => setTool("eraser-object")}
						title="Gumka (Cały Obiekt)"
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M3 6h18" />
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							<line x1="10" y1="11" x2="10" y2="17" />
							<line x1="14" y1="11" x2="14" y2="17" />
						</svg>
					</button>
				</div>

				<div
					className={`toolbar-section ${tool !== "pen" && tool !== "highlighter" && tool !== "shape" && tool !== "select" ? "disabled-ui" : ""}`}
				>
					<div className="color-grid">
						{colors.map((c) => (
							<div
								key={c}
								className={`color-swatch ${color === c ? "active" : ""}`}
								style={{ backgroundColor: c }}
								onClick={() => handleColorClick(c)}
								title={c}
							/>
						))}
					</div>
				</div>

				<div
					className={`toolbar-section ${tool === "eraser-object" || (tool === "select" && selectedIds.length === 0) ? "disabled-ui" : ""}`}
				>
					<div className="thickness-picker">
						<span className="tool-label">Grubość</span>
						<input
							type="range"
							min="2"
							max="40"
							value={thickness}
							onChange={handleThicknessChange}
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
			{showShapeMenu && (
				<div className={`shapes-flyout-container theme-${bgTheme}`}>
					<div className="shapes-panel-grid">
						{Object.keys(SHAPE_PATHS).map((key) => (
							<button
								key={key}
								className={`shape-select-btn ${shapeType === key && tool === "shape" ? "active" : ""}`}
								onClick={() => {
									setShapeType(key);
									setTool("shape");
								}}
								title={key}
							>
								<svg
									width="32"
									height="32"
									viewBox="0 0 100 100"
									stroke="currentColor"
									strokeWidth="6"
									strokeLinejoin="round"
									fill="none"
								>
									<path
										d={SHAPE_PATHS[key]}
										strokeDasharray={key === "dashedLine" ? "15,15" : "none"}
									/>
								</svg>
							</button>
						))}
					</div>
				</div>
			)}
			<div className={`canvas-wrapper ${isPanning ? "panning" : ""}`}>
				<div className="remote-cursors-overlay">
					{Object.entries(cursors).map(([uid, cursorData]) => {
						if (uid === currentUser?.uid) return null;
						const screenX = cursorData.x * stageConfig.scale + stageConfig.x;
						const screenY = cursorData.y * stageConfig.scale + stageConfig.y;

						const getCursorColor = (userId) => {
							const palettes = [
								{
									bg: "#e0f2fe",
									border: "#0284c7",
									text: "#0369a1",
									cursor: "#0ea5e9",
								},
								{
									bg: "#fce7f3",
									border: "#db2777",
									text: "#be185d",
									cursor: "#ec4899",
								},
								{
									bg: "#dcfce7",
									border: "#16a34a",
									text: "#15803d",
									cursor: "#22c55e",
								},
								{
									bg: "#fef3c7",
									border: "#d97706",
									text: "#b45309",
									cursor: "#f59e0b",
								},
								{
									bg: "#f3e8ff",
									border: "#9333ea",
									text: "#7e22ce",
									cursor: "#a855f7",
								},
							];
							let hash = 0;
							for (let i = 0; i < userId.length; i++) {
								hash = userId.charCodeAt(i) + ((hash << 5) - hash);
							}
							return palettes[Math.abs(hash) % palettes.length];
						};

						const palette = getCursorColor(uid);

						return (
							<div
								key={uid}
								className="remote-cursor"
								style={{ transform: `translate(${screenX}px, ${screenY}px)` }}
							>
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill={palette.cursor}
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42c.45 0 .67-.54.35-.85L5.5 3.21z"
										stroke="#ffffff"
										strokeWidth="1.5"
										strokeLinejoin="round"
									/>
								</svg>
								<div
									className="remote-cursor-label"
									style={{
										backgroundColor: palette.bg,
										borderColor: palette.border,
										color: palette.text,
									}}
								>
									{cursorData.name || "Uczeń"}
								</div>
							</div>
						);
					})}
				</div>

				{contextMenu && (
					<div
						className={`context-menu theme-${bgTheme}`}
						style={{ top: contextMenu.y, left: contextMenu.x }}
					>
						{contextMenu.hasSelection && (
							<>
								<button onClick={handleCopy} style={{ color: "var(--cyan)" }}>
									Kopiuj
								</button>
								<button onClick={handleDeleteSelected}>Usuń</button>
							</>
						)}
						{contextMenu.hasClipboardData && (
							<button
								onClick={() => handleInternalPaste(contextMenu.logicalPos)}
								style={{ color: "var(--cyan)" }}
							>
								Wklej
							</button>
						)}
						{!contextMenu.hasSelection && !contextMenu.hasClipboardData && (
							<span className="context-menu-empty">Brak akcji</span>
						)}
					</div>
				)}

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
					onContextMenu={handleContextMenu}
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
								scaleX={img.scaleX || 1}
								scaleY={img.scaleY || 1}
								rotation={img.rotation || 0}
								width={img.width}
								height={img.height}
								isDraggable={tool === "select"}
								onDragStart={handleDragStart}
								onDragMove={handleDragMove}
								onDragEnd={handleDragEnd}
								onTransformEnd={handleTransformEnd}
								isSelected={selectedIds.includes(img.id)}
							/>
						))}
						{lines.map((line) => {
							const commonProps = {
								key: line.id,
								id: line.id,
								name: "board-item",
								x: line.x || 0,
								y: line.y || 0,
								scaleX: line.scaleX || 1,
								scaleY: line.scaleY || 1,
								rotation: line.rotation || 0,
								stroke: line.color,
								strokeWidth:
									line.tool === "highlighter"
										? (line.thickness || 4) * 4
										: line.thickness || 4,
								opacity: line.tool === "highlighter" ? 0.4 : 1,
								draggable: tool === "select",
								onDragStart: (e) => handleDragStart(e, line.id),
								onDragMove: (e) => handleDragMove(e, line.id),
								onDragEnd: (e) => handleDragEnd(e, line.id),
								onTransformEnd: (e) => handleTransformEnd(e, line.id),
								shadowColor: selectedIds.includes(line.id)
									? "#00e5ff"
									: "transparent",
								shadowBlur: selectedIds.includes(line.id) ? 10 : 0,
								onMouseDown: (e) => {
									if (tool === "eraser-object") {
										e.cancelBubble = true;
										eraseLine(line.id);
									}
								},
								onMouseEnter: (e) => {
									if (tool === "select")
										e.target.getStage().container().style.cursor = "move";
									if (tool === "eraser-object" && e.evt.buttons === 1)
										eraseLine(line.id);
								},
								onMouseLeave: (e) => {
									if (tool === "select")
										e.target.getStage().container().style.cursor = "default";
								},
							};

							if (line.tool === "shape") {
								if (
									line.shapeType === "line" ||
									line.shapeType === "dashedLine"
								) {
									return (
										<Line
											{...commonProps}
											points={[0, 0, line.width, line.height]}
											dash={line.shapeType === "dashedLine" ? [25, 25] : []}
											strokeScaleEnabled={false}
											hitStrokeWidth={Math.max(line.thickness || 4, 15)}
										/>
									);
								}

								return (
									<Path
										{...commonProps}
										data={SHAPE_PATHS[line.shapeType] || SHAPE_PATHS.square}
										strokeScaleEnabled={false}
										lineCap="round"
										lineJoin="round"
									/>
								);
							}

							return (
								<Line
									{...commonProps}
									points={line.points || []}
									tension={0.7}
									lineCap="round"
									lineJoin="round"
									hitStrokeWidth={Math.max(line.thickness || 4, 15)}
									globalCompositeOperation={
										line.tool === "eraser-pixel"
											? "destination-out"
											: "source-over"
									}
								/>
							);
						})}

						{currentLine &&
							currentLine.tool === "shape" &&
							(currentLine.shapeType === "line" ||
							currentLine.shapeType === "dashedLine" ? (
								<Line
									x={currentLine.x}
									y={currentLine.y}
									points={[0, 0, currentLine.width, currentLine.height]}
									stroke={currentLine.color}
									strokeWidth={currentLine.thickness}
									dash={currentLine.shapeType === "dashedLine" ? [25, 25] : []}
									lineCap="round"
								/>
							) : (
								<Path
									x={currentLine.x}
									y={currentLine.y}
									scaleX={
										currentLine.width === 0 ? 0.01 : currentLine.width / 100
									}
									scaleY={
										currentLine.height === 0 ? 0.01 : currentLine.height / 100
									}
									data={
										SHAPE_PATHS[currentLine.shapeType] || SHAPE_PATHS.square
									}
									stroke={currentLine.color}
									strokeWidth={currentLine.thickness}
									strokeScaleEnabled={false}
									lineCap="round"
									lineJoin="round"
								/>
							))}

						{currentLine && currentLine.tool !== "shape" && (
							<Line
								points={currentLine.points || []}
								stroke={currentLine.color}
								strokeWidth={
									currentLine.tool === "highlighter"
										? (currentLine.thickness || 4) * 4
										: currentLine.thickness || 4
								}
								opacity={currentLine.tool === "highlighter" ? 0.4 : 1}
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

						{tool === "select" && (
							<Transformer
								ref={transformerRef}
								boundBoxFunc={(oldBox, newBox) => {
									if (newBox.width < 5 || newBox.height < 5) {
										return oldBox;
									}
									return newBox;
								}}
								borderStroke="#00e5ff"
								anchorStroke="#00e5ff"
								anchorFill="#0d1320"
								anchorSize={8}
							/>
						)}
					</Layer>
				</Stage>
			</div>
		</div>
	);
};

export default Room;
