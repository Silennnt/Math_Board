import { useState, useEffect, useRef } from "react";
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
	const [color, setColor] = useState("#00e5ff");
	const [tool, setTool] = useState("pen");
	const [isSaving, setIsSaving] = useState(false);

	const [dimensions, setDimensions] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	});

	useEffect(() => {
		const handleResize = () =>
			setDimensions({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
		const unsubscribe = onValue(
			linesDbRef,
			(snapshot) => {
				const data = snapshot.val();
				if (data) {
					setLines(Object.values(data));
				} else {
					setLines([]);
				}
			},
			(error) => {
				console.error("Błąd odczytu z Firebase:", error);
			},
		);

		return () => unsubscribe();
	}, [roomId]);

	const handleMouseDown = (e) => {
		setIsDrawing(true);
		const pos = e.target.getStage().getPointerPosition();
		setCurrentLine({ tool, color, points: [pos.x, pos.y] });
	};

	const handleMouseMove = (e) => {
		if (!isDrawing) return;
		const stage = e.target.getStage();
		const point = stage.getPointerPosition();

		setCurrentLine((prev) => {
			if (!prev) return null;
			return {
				...prev,
				points: prev.points.concat([point.x, point.y]),
			};
		});
	};

	const handleMouseUp = () => {
		setIsDrawing(false);
		if (currentLine) {
			const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
			push(linesDbRef, currentLine).catch((error) => {
				console.error("Błąd zapisu w Firebase:", error);
			});
			setCurrentLine(null);
		}
	};

	const handleClear = () => {
		const linesDbRef = dbRef(database, `rooms/${roomId}/lines`);
		remove(linesDbRef).catch((error) => {
			console.error("Błąd usuwania w Firebase:", error);
		});
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
			console.error("Błąd zapisu zrzutu ekranu:", error);
			alert("Wystąpił błąd podczas zapisywania tablicy.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="room-container">
			<div className="room-toolbar">
				<div className="toolbar-section">
					<button className="btn-leave" onClick={() => navigate("/dashboard")}>
						← Wróć
					</button>
					<span className="room-id">Pokój: {roomId}</span>
				</div>

				<div className="toolbar-section">
					<button
						className={`tool-btn ${tool === "pen" ? "active" : ""}`}
						onClick={() => setTool("pen")}
					>
						Pędzel
					</button>
					<button
						className={`tool-btn ${tool === "eraser" ? "active" : ""}`}
						onClick={() => setTool("eraser")}
					>
						Gumka
					</button>
				</div>

				<div className="toolbar-section color-picker">
					{["#00e5ff", "#a855f7", "#f472b6", "#f8fafc"].map((c) => (
						<div
							key={c}
							className={`color-swatch ${color === c && tool === "pen" ? "active" : ""}`}
							style={{ backgroundColor: c }}
							onClick={() => {
								setColor(c);
								setTool("pen");
							}}
						/>
					))}
				</div>

				<div className="toolbar-section">
					<button className="tool-btn danger" onClick={handleClear}>
						Wyczyść
					</button>
					<button
						className="btn-save"
						onClick={handleSaveAndExit}
						disabled={isSaving}
					>
						{isSaving ? "Zapisywanie..." : "Zakończ i Zapisz"}
					</button>
				</div>
			</div>

			<div className="canvas-wrapper">
				<Stage
					ref={stageRef}
					width={dimensions.width}
					height={dimensions.height}
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
							x={0}
							y={0}
							width={dimensions.width}
							height={dimensions.height}
							fill="#0d1320"
						/>
						{lines.map((line, i) => (
							<Line
								key={i}
								points={line.points || []}
								stroke={line.tool === "eraser" ? "#0d1320" : line.color}
								strokeWidth={line.tool === "eraser" ? 25 : 4}
								tension={0.5}
								lineCap="round"
								lineJoin="round"
								globalCompositeOperation={
									line.tool === "eraser" ? "destination-out" : "source-over"
								}
							/>
						))}

						{currentLine && (
							<Line
								points={currentLine.points || []}
								stroke={
									currentLine.tool === "eraser" ? "#0d1320" : currentLine.color
								}
								strokeWidth={currentLine.tool === "eraser" ? 25 : 4}
								tension={0.5}
								lineCap="round"
								lineJoin="round"
								globalCompositeOperation={
									currentLine.tool === "eraser"
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
