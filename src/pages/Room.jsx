import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Line, Rect } from "react-konva";
import { ref as dbRef, onValue, push, remove } from "firebase/database";
import {
	ref as storageRef,
	uploadString,
	getDownloadURL,
} from "firebase/storage";
import { database, storage } from "../firebase";
import "./Room.css";

const Room = () => {
	const { roomId } = useParams();
	const navigate = useNavigate();
	const stageRef = useRef(null);

	const [lines, setLines] = useState([]);
	const [currentLine, setCurrentLine] = useState(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [isPanning, setIsPanning] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

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

	useEffect(() => {
		const handleResize = () =>
			setDimensions({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
		const unsubscribe = onValue(linesDbRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				const loadedLines = Object.keys(data).map((key) => ({
					id: key,
					...data[key],
				}));
				setLines(loadedLines);
			} else {
				setLines([]);
			}
		});

		return () => unsubscribe();
	}, [roomId]);

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

	const handleMouseDown = (e) => {
		if (e.evt.button === 2 || e.evt.button === 1) {
			setIsPanning(true);
			return;
		}

		if (tool === "eraser-object") return;

		setIsDrawing(true);
		const pos = getLogicalPosition(e.target.getStage());
		setCurrentLine({ tool, color, thickness, points: [pos.x, pos.y] });
	};

	const handleMouseMove = (e) => {
		if (isPanning) {
			setStageConfig((prev) => ({
				...prev,
				x: prev.x + e.evt.movementX,
				y: prev.y + e.evt.movementY,
			}));
			return;
		}

		if (!isDrawing || tool === "eraser-object" || !currentLine) return;
		const pos = getLogicalPosition(e.target.getStage());

		setCurrentLine((prev) => ({
			...prev,
			points: prev.points.concat([pos.x, pos.y]),
		}));
	};

	const handleMouseUp = () => {
		if (isPanning) {
			setIsPanning(false);
			return;
		}
		setIsDrawing(false);
		if (currentLine) {
			const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
			push(linesDbRef, currentLine).catch(console.error);
			setCurrentLine(null);
		}
	};

	const handleContextMenu = (e) => e.preventDefault();

	const eraseLine = (id) => {
		const lineRef = dbRef(database, `rooms/${roomId}/lines/${id}`);
		remove(lineRef).catch(console.error);
	};

	const handleSaveAndExit = async () => {
		if (!stageRef.current) return;
		setIsSaving(true);
		try {
			const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
			const timestamp = Date.now();
			const imageRef = storageRef(
				storage,
				`rooms/${roomId}/screenshots/board_${timestamp}.png`,
			);

			await uploadString(imageRef, dataUrl, "data_url");
			const downloadUrl = await getDownloadURL(imageRef);

			const screenshotsDbRef = dbRef(database, `rooms/${roomId}/screenshots`);
			await push(screenshotsDbRef, {
				url: downloadUrl,
				createdAt: new Date().toISOString(),
			});

			const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
			await remove(linesDbRef);

			navigate("/dashboard");
		} catch (error) {
			console.error(error);
			alert("Wystąpił błąd podczas zapisywania tablicy.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			className="room-container"
			onContextMenu={handleContextMenu}
			style={{ backgroundColor: bgTheme === "dark" ? "#0d1320" : "#f8fafc" }}
		>
			{}
			<aside className={`room-toolbar left-toolbar theme-${bgTheme}`}>
				<div className="toolbar-section">
					<button
						className="btn-leave"
						onClick={() => navigate("/dashboard")}
						title="Wróć do panelu"
					>
						⏴ Wróć
					</button>
				</div>

				<div className="toolbar-section">
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

				{}
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

				{}
				<div
					className={`toolbar-section ${tool === "eraser-object" ? "disabled-ui" : ""}`}
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
						onClick={handleSaveAndExit}
						disabled={isSaving}
					>
						{isSaving ? "⏳" : "Zapisz"}
					</button>
				</div>
			</aside>

			<div className={`canvas-wrapper ${isPanning ? "panning" : ""}`}>
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
					onTouchStart={handleMouseDown}
					onTouchMove={handleMouseMove}
					onTouchEnd={handleMouseUp}
				>
					<Layer>
						{}
						<Rect
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
						{lines.map((line) => (
							<Line
								key={line.id}
								points={line.points || []}
								stroke={line.color}
								strokeWidth={line.thickness || 4}
								tension={0.5}
								lineCap="round"
								lineJoin="round"
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
									if (tool === "eraser-object" && e.evt.buttons === 1) {
										eraseLine(line.id);
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
					</Layer>
				</Stage>
			</div>
		</div>
	);
};

export default Room;
