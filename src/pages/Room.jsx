import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Line } from "react-konva";
import { ref, onValue, push, remove } from "firebase/database";
import { database } from "../firebase";
import "./Room.css";

const Room = () => {
	const { roomId } = useParams();
	const navigate = useNavigate();

	const [lines, setLines] = useState([]);
	const [currentLine, setCurrentLine] = useState(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [color, setColor] = useState("#00e5ff");
	const [tool, setTool] = useState("pen");

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
		const linesRef = ref(database, `rooms/${roomId}/lines`);
		const unsubscribe = onValue(
			linesRef,
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
			const linesRef = ref(database, `rooms/${roomId}/lines`);
			push(linesRef, currentLine).catch((error) => {
				console.error("Błąd zapisu w Firebase:", error);
				alert("Brak uprawnień. Sprawdź reguły bazy danych Firebase.");
			});
			setCurrentLine(null);
		}
	};

	const handleClear = () => {
		const linesRef = ref(database, `rooms/${roomId}/lines`);
		remove(linesRef).catch((error) => {
			console.error("Błąd usuwania w Firebase:", error);
		});
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
				</div>
			</div>

			<div className="canvas-wrapper">
				<Stage
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
