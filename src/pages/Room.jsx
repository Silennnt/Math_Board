import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Line } from "react-konva";
import "./Room.css";

const Room = () => {
	const { roomId } = useParams();
	const navigate = useNavigate();

	const [lines, setLines] = useState([]);
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

	const handleMouseDown = (e) => {
		setIsDrawing(true);
		const pos = e.target.getStage().getPointerPosition();
		setLines([...lines, { tool, color, points: [pos.x, pos.y] }]);
	};

	const handleMouseMove = (e) => {
		if (!isDrawing) return;
		const stage = e.target.getStage();
		const point = stage.getPointerPosition();
		let lastLine = lines[lines.length - 1];

		lastLine.points = lastLine.points.concat([point.x, point.y]);

		lines.splice(lines.length - 1, 1, lastLine);
		setLines([...lines]);
	};

	const handleMouseUp = () => {
		setIsDrawing(false);
	};

	const handleClear = () => {
		setLines([]);
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
								points={line.points}
								stroke={line.tool === "eraser" ? "#0b1120" : line.color}
								strokeWidth={line.tool === "eraser" ? 25 : 4}
								tension={0.5}
								lineCap="round"
								lineJoin="round"
								globalCompositeOperation={
									line.tool === "eraser" ? "destination-out" : "source-over"
								}
							/>
						))}
					</Layer>
				</Stage>
			</div>
		</div>
	);
};

export default Room;
