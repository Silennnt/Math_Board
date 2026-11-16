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
	Text as KonvaText,
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
import Swal from "sweetalert2";

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

const TEXT_LINE_HEIGHT = 1.2;

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
	listening = true,
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
			listening={listening}
			onDragStart={(e) => onDragStart(e, id)}
			onDragMove={(e) => onDragMove(e, id)}
			onDragEnd={(e) => onDragEnd(e, id)}
			onTransformEnd={(e) => onTransformEnd(e, id)}
			shadowColor={isSelected ? "#00e5ff" : "transparent"}
			shadowBlur={isSelected ? 8 : 0}
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
	const hiddenInputRef = useRef(null);
	const measureCanvasRef = useRef(null);

	const [lines, setLines] = useState([]);
	const [images, setImages] = useState([]);
	const [texts, setTexts] = useState([]);
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
	const [placeholders, setPlaceholders] = useState([]);
	const isTextDrawing = useRef(false);
	const textDragStart = useRef(null);
	const [textDragBox, setTextDragBox] = useState(null);
	const [editingTextInfo, setEditingTextInfo] = useState(null);
	const [caretIndex, setCaretIndex] = useState(0);
	const [caretVisible, setCaretVisible] = useState(true);

	const dragNodesRef = useRef([]);
	const isPanningMoved = useRef(false);
	const [contextMenu, setContextMenu] = useState(null);
	const internalClipboard = useRef({
		lines: [],
		images: [],
		texts: [],
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

	const getWrappedLines = (text, maxWidth, fontSize) => {
		if (!measureCanvasRef.current) {
			measureCanvasRef.current = document.createElement("canvas");
		}
		const ctx = measureCanvasRef.current.getContext("2d");
		ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;

		const rawLines = (text || "").split("\n");
		const visualLines = [];
		let currentOffset = 0;

		rawLines.forEach((rawLine, rIdx) => {
			if (rawLine.length === 0) {
				visualLines.push({
					text: "",
					start: currentOffset,
					end: currentOffset,
				});
			} else if (!maxWidth || maxWidth <= 0) {
				visualLines.push({
					text: rawLine,
					start: currentOffset,
					end: currentOffset + rawLine.length,
				});
			} else {
				const tokens = rawLine.split(/(\s+)/);
				let lineText = "";
				let lineStart = currentOffset;

				tokens.forEach((token) => {
					if (!token) return;
					const testLine = lineText + token;
					if (ctx.measureText(testLine).width <= maxWidth || lineText === "") {
						if (ctx.measureText(token).width > maxWidth && lineText === "") {
							for (let i = 0; i < token.length; i++) {
								const ch = token[i];
								if (
									ctx.measureText(lineText + ch).width > maxWidth &&
									lineText.length > 0
								) {
									visualLines.push({
										text: lineText,
										start: lineStart,
										end: lineStart + lineText.length,
									});
									lineStart += lineText.length;
									lineText = ch;
								} else {
									lineText += ch;
								}
							}
						} else {
							lineText = testLine;
						}
					} else {
						visualLines.push({
							text: lineText,
							start: lineStart,
							end: lineStart + lineText.length,
						});
						lineStart += lineText.length;
						lineText = token;
					}
				});

				visualLines.push({
					text: lineText,
					start: lineStart,
					end: lineStart + lineText.length,
				});
			}

			currentOffset += rawLine.length + (rIdx < rawLines.length - 1 ? 1 : 0);
		});

		return { visualLines, ctx };
	};

	const getCharIndexAtPoint = (text, maxWidth, fontSize, localX, localY) => {
		const { visualLines, ctx } = getWrappedLines(text, maxWidth, fontSize);
		if (visualLines.length === 0) return 0;

		const lineHeightPx = fontSize * TEXT_LINE_HEIGHT;
		const lineIdx = Math.max(
			0,
			Math.min(visualLines.length - 1, Math.floor(localY / lineHeightPx)),
		);
		const line = visualLines[lineIdx];

		let bestOffset = 0;
		let bestDist = Infinity;
		for (let i = 0; i <= line.text.length; i++) {
			const w = ctx.measureText(line.text.slice(0, i)).width;
			const dist = Math.abs(w - localX);
			if (dist < bestDist) {
				bestDist = dist;
				bestOffset = i;
			}
		}

		return line.start + bestOffset;
	};

	const caretCoords = useMemo(() => {
		if (!editingTextInfo) return { x: 0, y: 0, height: 22 };
		const fontSize = editingTextInfo.fontSize || 22;
		const lineHeightPx = fontSize * TEXT_LINE_HEIGHT;
		const { visualLines, ctx } = getWrappedLines(
			editingTextInfo.text,
			editingTextInfo.width,
			fontSize,
		);

		if (visualLines.length === 0) {
			return { x: 0, y: 0, height: fontSize * 1.1 };
		}

		const clampedIdx = Math.max(
			0,
			Math.min((editingTextInfo.text || "").length, caretIndex),
		);
		let targetLineIdx = 0;

		for (let i = 0; i < visualLines.length; i++) {
			const line = visualLines[i];
			if (clampedIdx >= line.start && clampedIdx <= line.end) {
				if (
					i < visualLines.length - 1 &&
					visualLines[i + 1].start === clampedIdx
				) {
					targetLineIdx = i + 1;
				} else {
					targetLineIdx = i;
				}
				break;
			}
		}

		const activeLine = visualLines[targetLineIdx];
		const subStr = activeLine.text.slice(
			0,
			Math.max(0, clampedIdx - activeLine.start),
		);
		const x = ctx.measureText(subStr).width;
		const y = targetLineIdx * lineHeightPx;

		return { x, y, height: fontSize * 1.1 };
	}, [editingTextInfo, caretIndex]);

	useEffect(() => {
		if (!editingTextInfo) return;
		setCaretVisible(true);
		const interval = setInterval(() => {
			setCaretVisible((prev) => !prev);
		}, 530);
		return () => clearInterval(interval);
	}, [editingTextInfo, caretIndex]);

	const startEditingText = (info, initialCaret = null) => {
		const targetCaret =
			initialCaret !== null ? initialCaret : (info.text || "").length;
		setEditingTextInfo(info);
		setCaretIndex(targetCaret);
		setCaretVisible(true);
		setSelectedIds([]);

		setTimeout(() => {
			if (hiddenInputRef.current) {
				hiddenInputRef.current.value = info.text || "";
				hiddenInputRef.current.focus();
				hiddenInputRef.current.setSelectionRange(targetCaret, targetCaret);
			}
		}, 10);
	};

	const handleColorClick = (newColor) => {
		setColor(newColor);
		if (editingTextInfo) {
			setEditingTextInfo((prev) => ({ ...prev, color: newColor }));
		}
		if (selectedIds.length > 0) {
			const updates = {};
			selectedIds.forEach((id) => {
				if (linesRef.current.some((l) => l.id === id)) {
					updates[`lines/${id}/color`] = newColor;
				}
				if (textsRef.current.some((t) => t.id === id)) {
					updates[`texts/${id}/color`] = newColor;
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
		if (editingTextInfo) {
			setEditingTextInfo((prev) => ({
				...prev,
				fontSize: Math.max(16, newThick * 4),
			}));
		}
		if (selectedIds.length > 0) {
			const updates = {};
			selectedIds.forEach((id) => {
				if (linesRef.current.some((l) => l.id === id)) {
					updates[`lines/${id}/thickness`] = newThick;
				}
				if (textsRef.current.some((t) => t.id === id)) {
					updates[`texts/${id}/fontSize`] = Math.max(16, newThick * 4);
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

	const linesRef = useRef(lines);
	const imagesRef = useRef(images);
	const textsRef = useRef(texts);
	const stageConfigRef = useRef(stageConfig);

	useEffect(() => {
		linesRef.current = lines;
	}, [lines]);

	useEffect(() => {
		imagesRef.current = images;
	}, [images]);

	useEffect(() => {
		textsRef.current = texts;
	}, [texts]);

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

	const updateCursor = () => {
		if (!stageRef.current) return;
		const container = stageRef.current.container();

		const penSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#0d1320" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`;
		const eraserSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#0d1320" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`;

		const penCursor = `url('data:image/svg+xml;utf8,${encodeURIComponent(penSvg)}') 2 22, crosshair`;
		const eraserCursor = `url('data:image/svg+xml;utf8,${encodeURIComponent(eraserSvg)}') 3 19, crosshair`;

		if (tool === "select") {
			container.style.cursor = "default";
		} else if (tool === "pen" || tool === "highlighter") {
			container.style.cursor = penCursor;
		} else if (tool === "eraser-pixel" || tool === "eraser-object") {
			container.style.cursor = eraserCursor;
		} else if (tool === "text") {
			container.style.cursor = "text";
		} else {
			container.style.cursor = "crosshair";
		}
	};

	useEffect(() => {
		updateCursor();
		window.addEventListener("focus", updateCursor);
		return () => window.removeEventListener("focus", updateCursor);
	}, [tool]);

	useEffect(() => {
		if (tool === "select" && transformerRef.current && !editingTextInfo) {
			const stage = stageRef.current;
			const nodes = selectedIds
				.map((id) => stage.findOne("#" + id))
				.filter(Boolean);
			transformerRef.current.nodes(nodes);
			transformerRef.current.getLayer().batchDraw();
		} else if (transformerRef.current) {
			transformerRef.current.nodes([]);
		}
	}, [selectedIds, tool, lines, images, texts, editingTextInfo]);

	const commitText = () => {
		if (!editingTextInfo) return;
		const currentInfo = editingTextInfo;
		setEditingTextInfo(null);

		const trimmed = (currentInfo.text || "").trim();

		if (!trimmed) {
			if (currentInfo.id) {
				remove(
					dbRef(database, `rooms/${roomId}/texts/${currentInfo.id}`),
				).catch(() => {});
			}
			return;
		}

		if (currentInfo.id) {
			update(dbRef(database, `rooms/${roomId}/texts/${currentInfo.id}`), {
				text: currentInfo.text,
				color: currentInfo.color || color,
				width: currentInfo.width || 240,
				fontSize: currentInfo.fontSize || 22,
			}).catch(() => {});
		} else {
			const newText = {
				text: currentInfo.text,
				x: currentInfo.x,
				y: currentInfo.y,
				width: currentInfo.width || 240,
				fontSize: currentInfo.fontSize || 22,
				color: currentInfo.color || color,
				scaleX: 1,
				scaleY: 1,
				rotation: 0,
				uid: currentUser?.uid || "user",
				timestamp: Date.now(),
			};
			push(dbRef(database, `rooms/${roomId}/texts`), newText).catch(() => {});
		}
	};

	const handleCopy = () => {
		if (selectedIds.length === 0) return;
		const copiedLines = linesRef.current.filter((l) =>
			selectedIds.includes(l.id),
		);
		const copiedImages = imagesRef.current.filter((i) =>
			selectedIds.includes(i.id),
		);
		const copiedTexts = textsRef.current.filter((t) =>
			selectedIds.includes(t.id),
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
			texts: copiedTexts,
			center: { x: cx, y: cy },
		};
		setContextMenu(null);

		try {
			navigator.clipboard.writeText("board-internal-copy").catch(() => {});
		} catch (err) {}
	};

	const handleInternalPaste = (targetPos = null) => {
		const {
			lines: cLines,
			images: cImages,
			texts: cTexts = [],
			center,
		} = internalClipboard.current;
		if (cLines.length === 0 && cImages.length === 0 && cTexts.length === 0)
			return;

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

		cTexts.forEach((txt) => {
			const newTxt = {
				...txt,
				uid: currentUser.uid,
				timestamp: batchTimestamp,
				x: (txt.x || 0) + dx,
				y: (txt.y || 0) + dy,
			};
			delete newTxt.id;
			const newRef = push(dbRef(database, `rooms/${roomId}/texts`), newTxt);
			newSelectedIds.push(newRef.key);
		});

		setSelectedIds(newSelectedIds);
		setContextMenu(null);
	};

	useEffect(() => {
		if (containerRef.current && !editingTextInfo) {
			containerRef.current.focus();
		}

		const handleKeyDown = (e) => {
			if (editingTextInfo) return;

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
					const myTexts = textsRef.current.filter(
						(t) => t.uid === currentUser?.uid,
					);

					const allMyItems = [
						...myLines.map((l) => ({ ...l, type: "line" })),
						...myImages.map((img) => ({ ...img, type: "image" })),
						...myTexts.map((t) => ({ ...t, type: "text" })),
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
							} else if (item.type === "image") {
								remove(dbRef(database, `rooms/${roomId}/images/${item.id}`));
							} else if (item.type === "text") {
								remove(dbRef(database, `rooms/${roomId}/texts/${item.id}`));
							}
						});
					}
				} else if (key === "c") {
					e.preventDefault();
					handleCopy();
				}
			} else if (e.key === "Delete" || e.key === "Backspace") {
				handleDeleteSelected();
			}
		};

		const handlePaste = async (e) => {
			if (editingTextInfo) return;
			const clipboardData = e.clipboardData || window.clipboardData;
			if (!clipboardData) return;

			const textData = clipboardData.getData("text");
			if (textData === "board-internal-copy") {
				e.preventDefault();
				handleInternalPaste();
				return;
			}

			const items = clipboardData.items;
			let hasImage = false;
			let imageBlob = null;

			for (let i = 0; i < items.length; i++) {
				if (items[i].type.indexOf("image") !== -1) {
					hasImage = true;
					imageBlob = items[i].getAsFile();
					break;
				}
			}

			if (hasImage && imageBlob) {
				e.preventDefault();
				const localUrl = URL.createObjectURL(imageBlob);
				const img = new window.Image();

				img.onload = async () => {
					const tempId = "placeholder_" + Date.now();
					const config = stageConfigRef.current;
					let containerRect = { left: 0, top: 0 };
					if (containerRef.current) {
						containerRect = containerRef.current.getBoundingClientRect();
					}
					const pointerX = globalMousePos.current.x - containerRect.left;
					const pointerY = globalMousePos.current.y - containerRect.top;

					const x = (pointerX - config.x) / config.scale - img.width / 2;
					const y = (pointerY - config.y) / config.scale - img.height / 2;

					setPlaceholders((prev) => [
						...prev,
						{ id: tempId, x, y, width: img.width, height: img.height },
					]);

					try {
						const fileRef = storageRef(
							storage,
							`rooms/${roomId}/uploads/paste_${Date.now()}.png`,
						);
						await uploadBytes(fileRef, imageBlob);
						const downloadUrl = await getDownloadURL(fileRef);

						const batchTimestamp = Date.now();
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
						console.error("Błąd podczas wklejania:", error);
					} finally {
						URL.revokeObjectURL(localUrl);
						setPlaceholders((prev) => prev.filter((p) => p.id !== tempId));
					}
				};
				img.src = localUrl;
			} else {
				if (
					internalClipboard.current.lines.length > 0 ||
					internalClipboard.current.images.length > 0 ||
					internalClipboard.current.texts.length > 0
				) {
					handleInternalPaste();
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("paste", handlePaste);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("paste", handlePaste);
		};
	}, [roomId, currentUser, selectedIds, editingTextInfo]);

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

		const textsDbRef = dbRef(database, `rooms/${roomId}/texts`);
		const unsubscribeTexts = onValue(textsDbRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				setTexts(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
			} else {
				setTexts([]);
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
			unsubscribeImages();
			unsubscribeTexts();
			unsubscribeCursors();
			unsubscribeSession();
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

		if (activeIds.length > 1 && transformerRef.current) {
			transformerRef.current.nodes([]);
		}

		const layer = transformerRef.current
			? transformerRef.current.getLayer()
			: stageRef.current.getLayers()[1];
		const selectedSet = new Set(activeIds);
		const cached = [];

		if (layer) {
			layer.getChildren().forEach((node) => {
				const nodeId = node.id();
				if (nodeId && selectedSet.has(nodeId)) {
					cached.push({
						id: nodeId,
						node: node,
						startX: node.x(),
						startY: node.y(),
					});
				}
			});
		}

		dragNodesRef.current = cached;
	};

	const handleDragMove = (e, id) => {
		const leader = dragNodesRef.current.find((item) => item.id === id);
		if (!leader) return;
		const dx = e.target.x() - leader.startX;
		const dy = e.target.y() - leader.startY;

		for (let i = 0; i < dragNodesRef.current.length; i++) {
			const item = dragNodesRef.current[i];
			if (item.id !== id) {
				item.node.position({
					x: item.startX + dx,
					y: item.startY + dy,
				});
			}
		}
	};

	const handleDragEnd = (e, id) => {
		const updates = {};
		const restoredNodes = [];

		dragNodesRef.current.forEach((item) => {
			const selId = item.id;
			const node = item.node;
			restoredNodes.push(node);

			const isLine = linesRef.current.some((l) => l.id === selId);
			const isImg = imagesRef.current.some((i) => i.id === selId);
			const isText = textsRef.current.some((t) => t.id === selId);

			if (isLine) {
				updates[`lines/${selId}/x`] = node.x();
				updates[`lines/${selId}/y`] = node.y();
			} else if (isImg) {
				updates[`images/${selId}/x`] = node.x();
				updates[`images/${selId}/y`] = node.y();
			} else if (isText) {
				updates[`texts/${selId}/x`] = node.x();
				updates[`texts/${selId}/y`] = node.y();
			}
		});

		dragNodesRef.current = [];

		if (
			tool === "select" &&
			transformerRef.current &&
			restoredNodes.length > 0
		) {
			transformerRef.current.nodes(restoredNodes);
			transformerRef.current.getLayer()?.batchDraw();
		}

		if (Object.keys(updates).length > 0) {
			update(dbRef(database, `rooms/${roomId}`), updates).catch(() => {});
		}
	};

	const handleTransformEnd = (e, id) => {
		const node = e.target;
		const updates = {};
		const isLine = linesRef.current.some((l) => l.id === id);
		const isImg = imagesRef.current.some((i) => i.id === id);
		const isText = textsRef.current.some((t) => t.id === id);

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
		} else if (isText) {
			const newWidth = Math.max(30, (node.width() || 100) * node.scaleX());
			node.scaleX(1);
			node.scaleY(1);
			node.width(newWidth);

			updates[`texts/${id}/x`] = node.x();
			updates[`texts/${id}/y`] = node.y();
			updates[`texts/${id}/width`] = newWidth;
			updates[`texts/${id}/scaleX`] = 1;
			updates[`texts/${id}/scaleY`] = 1;
			updates[`texts/${id}/rotation`] = node.rotation();
		}

		if (Object.keys(updates).length > 0) {
			update(dbRef(database, `rooms/${roomId}`), updates).catch(() => {});
		}
	};

	const handleMouseDown = (e) => {
		isPanningMoved.current = false;
		if (contextMenu) setContextMenu(null);
		if (animationRef.current) cancelAnimationFrame(animationRef.current);

		const pos = getLogicalPosition(e.target.getStage());

		if (editingTextInfo) {
			const targetId = e.target.id();
			if (editingTextInfo.id && targetId === editingTextInfo.id) {
				const localX = pos.x - (editingTextInfo.x || 0);
				const localY = pos.y - (editingTextInfo.y || 0);
				const idx = getCharIndexAtPoint(
					editingTextInfo.text,
					editingTextInfo.width || 240,
					editingTextInfo.fontSize || 22,
					localX,
					localY,
				);
				setCaretIndex(idx);
				setCaretVisible(true);
				if (hiddenInputRef.current) {
					hiddenInputRef.current.focus();
					hiddenInputRef.current.setSelectionRange(idx, idx);
				}
				return;
			}
			commitText();
		}

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

		if (tool === "text") {
			const targetId = e.target.id();
			const clickedText = textsRef.current.find((t) => t.id === targetId);

			if (clickedText) {
				const localX = pos.x - (clickedText.x || 0);
				const localY = pos.y - (clickedText.y || 0);
				const idx = getCharIndexAtPoint(
					clickedText.text || "",
					clickedText.width || 240,
					clickedText.fontSize || 22,
					localX,
					localY,
				);
				startEditingText(
					{
						id: clickedText.id,
						x: clickedText.x || 0,
						y: clickedText.y || 0,
						width: clickedText.width || 240,
						text: clickedText.text || "",
						color: clickedText.color || color,
						fontSize: clickedText.fontSize || 22,
					},
					idx,
				);
				return;
			}

			isTextDrawing.current = true;
			textDragStart.current = pos;
			setTextDragBox({
				startX: pos.x,
				startY: pos.y,
				x: pos.x,
				y: pos.y,
				width: 0,
				height: 0,
			});
			return;
		}

		if (tool !== "select") {
			setSelectedIds([]);
		}

		if (tool === "select") {
			const clickedOnEmpty =
				e.target === e.target.getStage() || e.target === bgRectRef.current;

			if (clickedOnEmpty) {
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

		if (tool === "text" && isTextDrawing.current && textDragStart.current) {
			const start = textDragStart.current;
			setTextDragBox({
				startX: start.x,
				startY: start.y,
				x: Math.min(start.x, logicalPos.x),
				y: Math.min(start.y, logicalPos.y),
				width: Math.abs(logicalPos.x - start.x),
				height: Math.abs(logicalPos.y - start.y),
			});
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
			tool === "text" ||
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
				const threshold = 25 / (stageConfig.scale * stageConfig.scale);

				if (distSq < threshold) {
					return prev;
				}
			}
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

		if (tool === "text" && isTextDrawing.current) {
			isTextDrawing.current = false;
			const start = textDragStart.current;
			textDragStart.current = null;

			const currentBox = textDragBox;
			setTextDragBox(null);

			let targetX = start ? start.x : 0;
			let targetY = start ? start.y : 0;
			let targetWidth = 240;

			if (currentBox && currentBox.width > 20) {
				targetX = currentBox.x;
				targetY = currentBox.y;
				targetWidth = Math.max(120, currentBox.width);
			}

			startEditingText(
				{
					id: null,
					x: targetX,
					y: targetY,
					width: targetWidth,
					text: "",
					color: color,
					fontSize: Math.max(18, thickness * 4),
				},
				0,
			);
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

	useEffect(() => {
		const handleGlobalMouseUp = () => {
			if (isDrawing) {
				handleMouseUp();
			}
		};
		window.addEventListener("mouseup", handleGlobalMouseUp);
		return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
	}, [isDrawing, currentLine]);

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
			internalClipboard.current.images.length > 0 ||
			(internalClipboard.current.texts &&
				internalClipboard.current.texts.length > 0);

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
			const isText = textsRef.current.some((t) => t.id === id);

			if (isLine) {
				remove(dbRef(database, `rooms/${roomId}/lines/${id}`));
			} else if (isImg) {
				remove(dbRef(database, `rooms/${roomId}/images/${id}`));
			} else if (isText) {
				remove(dbRef(database, `rooms/${roomId}/texts/${id}`));
			}
		});
		setSelectedIds([]);
		setContextMenu(null);
	};

	const eraseLine = (id) => {
		const lineRef = dbRef(database, `rooms/${roomId}/lines/${id}`);
		remove(lineRef).catch(() => {});
	};

	const eraseText = (id) => {
		const textRef = dbRef(database, `rooms/${roomId}/texts/${id}`);
		remove(textRef).catch(() => {});
	};

	const handleClearBoard = () => {
		Swal.fire({
			title: "Czyszczenie tablicy",
			text: "To trwale usunie wszystkie rysunki, teksty i zrzuty z obecnego cyklu. Upewnij się, że masz zapisany zrzut.",
			icon: "warning",
			showCancelButton: true,
			confirmButtonText: "Wyczyść",
			cancelButtonText: "Anuluj",
		}).then((result) => {
			if (result.isConfirmed) {
				remove(dbRef(database, `rooms/${roomId}/lines`));
				remove(dbRef(database, `rooms/${roomId}/images`));
				remove(dbRef(database, `rooms/${roomId}/texts`));
				remove(dbRef(database, `rooms/${roomId}/sessionInfo`));
				Swal.fire({
					toast: true,
					position: "top-end",
					icon: "success",
					title: "Tablica wyczyszczona",
					showConfirmButton: false,
					timer: 5000,
				});
			}
		});
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

			Swal.fire({
				toast: true,
				position: "top-end",
				icon: "success",
				title: "Zapisano zrzut tablicy!",
				showConfirmButton: false,
				timer: 5000,
			});
		} catch (error) {
			Swal.fire({
				toast: true,
				position: "top-end",
				icon: "error",
				title: "Błąd generowania zrzutu",
				showConfirmButton: false,
				timer: 5000,
			});
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
					<button
						className={`tool-icon-btn ${tool === "text" ? "active" : ""}`}
						onClick={() => setTool("text")}
						title="Tekst (T)"
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
							<polyline points="4 7 4 4 20 4 20 7" />
							<line x1="9" y1="20" x2="15" y2="20" />
							<line x1="12" y1="4" x2="12" y2="20" />
						</svg>
					</button>
				</div>

				<div
					className={`toolbar-section ${
						tool !== "pen" &&
						tool !== "highlighter" &&
						tool !== "shape" &&
						tool !== "select" &&
						tool !== "text"
							? "disabled-ui"
							: ""
					}`}
					onMouseDown={(e) => {
						if (editingTextInfo) e.preventDefault();
					}}
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
					className={`toolbar-section ${
						tool === "eraser-object" ||
						(tool === "select" && selectedIds.length === 0 && !editingTextInfo)
							? "disabled-ui"
							: ""
					}`}
					onMouseDown={(e) => {
						if (editingTextInfo) e.preventDefault();
					}}
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
				<textarea
					ref={hiddenInputRef}
					className="hidden-text-input"
					aria-hidden="true"
					tabIndex={-1}
					value={editingTextInfo ? editingTextInfo.text : ""}
					onChange={(e) => {
						if (!editingTextInfo) return;
						const val = e.target.value;
						const pos = e.target.selectionStart ?? val.length;
						setEditingTextInfo((prev) =>
							prev ? { ...prev, text: val } : null,
						);
						setCaretIndex(pos);
					}}
					onSelect={(e) => {
						if (!editingTextInfo) return;
						setCaretIndex(e.target.selectionStart ?? 0);
					}}
					onKeyUp={(e) => {
						if (!editingTextInfo) return;
						setCaretIndex(e.target.selectionStart ?? 0);
					}}
					onKeyDown={(e) => {
						if (!editingTextInfo) return;
						e.stopPropagation();
						if (
							e.key === "Escape" ||
							(e.key === "Enter" && (e.ctrlKey || e.metaKey))
						) {
							e.preventDefault();
							commitText();
						}
					}}
					onBlur={() => {
						if (editingTextInfo) {
							commitText();
						}
					}}
				/>

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
						{placeholders.flatMap((p) => [
							<Rect
								key={`${p.id}_bg`}
								x={p.x}
								y={p.y}
								width={p.width}
								height={p.height}
								fill={
									bgTheme === "dark"
										? "rgba(255, 255, 255, 0.05)"
										: "rgba(0, 0, 0, 0.05)"
								}
								stroke={
									bgTheme === "dark"
										? "rgba(255, 255, 255, 0.2)"
										: "rgba(0, 0, 0, 0.2)"
								}
								strokeWidth={2}
								dash={[8, 8]}
								listening={false}
							/>,
							<KonvaText
								key={`${p.id}_txt`}
								x={p.x}
								y={p.y}
								width={p.width}
								height={p.height}
								text="Wklejanie..."
								align="center"
								verticalAlign="middle"
								fill={
									bgTheme === "dark"
										? "rgba(255, 255, 255, 0.4)"
										: "rgba(0, 0, 0, 0.4)"
								}
								fontSize={Math.max(14, p.width * 0.08)}
								fontFamily="system-ui, -apple-system, sans-serif"
								listening={false}
							/>,
						])}

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
								listening={tool === "select"}
								onDragStart={handleDragStart}
								onDragMove={handleDragMove}
								onDragEnd={handleDragEnd}
								onTransformEnd={handleTransformEnd}
								isSelected={selectedIds.includes(img.id)}
							/>
						))}

						{texts.map((t) => {
							const isBeingEdited =
								editingTextInfo && editingTextInfo.id === t.id;
							const displayText = isBeingEdited ? editingTextInfo.text : t.text;
							const displayColor = isBeingEdited
								? editingTextInfo.color
								: t.color || color;
							const displayFontSize = isBeingEdited
								? editingTextInfo.fontSize
								: t.fontSize || 22;
							const displayWidth = isBeingEdited
								? editingTextInfo.width
								: t.width || undefined;

							return (
								<KonvaText
									key={t.id}
									id={t.id}
									name="board-item"
									text={displayText}
									x={t.x || 0}
									y={t.y || 0}
									width={displayWidth}
									wrap="word"
									lineHeight={TEXT_LINE_HEIGHT}
									fontSize={displayFontSize}
									fontFamily="system-ui, -apple-system, sans-serif"
									fontStyle="bold"
									fill={displayColor}
									scaleX={t.scaleX || 1}
									scaleY={t.scaleY || 1}
									rotation={t.rotation || 0}
									draggable={tool === "select" && !isBeingEdited}
									listening={
										tool === "select" ||
										tool === "text" ||
										tool === "eraser-object"
									}
									onDragStart={(e) => handleDragStart(e, t.id)}
									onDragMove={(e) => handleDragMove(e, t.id)}
									onDragEnd={(e) => handleDragEnd(e, t.id)}
									onTransform={(e) => {
										const node = e.target;
										const scaleX = node.scaleX();
										node.setAttrs({
											width: Math.max(30, (node.width() || 100) * scaleX),
											scaleX: 1,
											scaleY: 1,
										});
									}}
									onTransformEnd={(e) => handleTransformEnd(e, t.id)}
									onDblClick={(e) => {
										e.cancelBubble = true;
										const pos = getLogicalPosition(e.target.getStage());
										const idx = getCharIndexAtPoint(
											t.text || "",
											t.width || 240,
											t.fontSize || 22,
											pos.x - (t.x || 0),
											pos.y - (t.y || 0),
										);
										startEditingText(
											{
												id: t.id,
												x: t.x || 0,
												y: t.y || 0,
												width: t.width || 240,
												text: t.text || "",
												color: t.color || color,
												fontSize: t.fontSize || 22,
											},
											idx,
										);
									}}
									onDblTap={(e) => {
										if (e) e.cancelBubble = true;
										startEditingText(
											{
												id: t.id,
												x: t.x || 0,
												y: t.y || 0,
												width: t.width || 240,
												text: t.text || "",
												color: t.color || color,
												fontSize: t.fontSize || 22,
											},
											(t.text || "").length,
										);
									}}
									shadowColor={
										selectedIds.includes(t.id) && selectedIds.length === 1
											? "#00e5ff"
											: "transparent"
									}
									shadowBlur={
										selectedIds.includes(t.id) && selectedIds.length === 1
											? 6
											: 0
									}
									onMouseEnter={(e) => {
										if (tool === "select")
											e.target.getStage().container().style.cursor = "move";
										if (tool === "text")
											e.target.getStage().container().style.cursor = "text";
										if (tool === "eraser-object" && e.evt.buttons === 1)
											eraseText(t.id);
									}}
									onMouseLeave={(e) => {
										if (tool === "select")
											e.target.getStage().container().style.cursor = "default";
									}}
									onMouseDown={(e) => {
										if (tool === "eraser-object") {
											e.cancelBubble = true;
											eraseText(t.id);
										}
									}}
								/>
							);
						})}

						{editingTextInfo && !editingTextInfo.id && (
							<KonvaText
								text={editingTextInfo.text}
								x={editingTextInfo.x}
								y={editingTextInfo.y}
								width={editingTextInfo.width}
								wrap="word"
								lineHeight={TEXT_LINE_HEIGHT}
								fontSize={editingTextInfo.fontSize || 22}
								fontFamily="system-ui, -apple-system, sans-serif"
								fontStyle="bold"
								fill={editingTextInfo.color || color}
								listening={false}
							/>
						)}

						{editingTextInfo && caretVisible && (
							<Line
								points={[
									editingTextInfo.x + caretCoords.x,
									editingTextInfo.y + caretCoords.y,
									editingTextInfo.x + caretCoords.x,
									editingTextInfo.y + caretCoords.y + caretCoords.height,
								]}
								stroke={editingTextInfo.color || color}
								strokeWidth={Math.max(
									2,
									(editingTextInfo.fontSize || 22) * 0.08,
								)}
								lineCap="round"
								listening={false}
							/>
						)}

						{lines.map((line) => {
							const isSelected = selectedIds.includes(line.id);
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
								perfectDrawEnabled: false,
								shadowForStrokeEnabled: false,
								draggable: tool === "select",
								listening: tool === "select" || tool === "eraser-object",
								onDragStart: (e) => handleDragStart(e, line.id),
								onDragMove: (e) => handleDragMove(e, line.id),
								onDragEnd: (e) => handleDragEnd(e, line.id),
								onTransformEnd: (e) => handleTransformEnd(e, line.id),
								shadowColor:
									isSelected && selectedIds.length === 1
										? "#00e5ff"
										: "transparent",
								shadowBlur: isSelected && selectedIds.length === 1 ? 6 : 0,
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
									listening={false}
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
									listening={false}
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
								listening={false}
								globalCompositeOperation={
									currentLine.tool === "eraser-pixel"
										? "destination-out"
										: "source-over"
								}
							/>
						)}

						{textDragBox && (
							<Rect
								x={textDragBox.x}
								y={textDragBox.y}
								width={textDragBox.width}
								height={textDragBox.height}
								fill="rgba(0, 229, 255, 0.12)"
								stroke="#00e5ff"
								strokeWidth={1.5 / stageConfig.scale}
								dash={[6 / stageConfig.scale, 4 / stageConfig.scale]}
								listening={false}
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
								listening={false}
							/>
						)}

						{tool === "select" && !editingTextInfo && (
							<Transformer
								ref={transformerRef}
								enabledAnchors={
									selectedIds.length > 0 &&
									selectedIds.every((id) =>
										textsRef.current.some((t) => t.id === id),
									)
										? ["middle-left", "middle-right"]
										: [
												"top-left",
												"top-center",
												"top-right",
												"middle-right",
												"middle-left",
												"bottom-left",
												"bottom-center",
												"bottom-right",
											]
								}
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
