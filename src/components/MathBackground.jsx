import React from "react";
import FloatingMath from "./FloatingMath";
import "./MathBackground.css";

const MathBackground = () => {
	return (
		<div className="math-background-fixed-wrapper">
			<div className="grid-bg"></div>
			<div className="hero-canvas">
				<div className="hero-glow-1"></div>
				<div className="hero-glow-2"></div>

				<div className="hero-shape hero-shape-1">
					<div className="cube" style={{ animationDuration: "18s" }}>
						<div className="cube-face cf-front">∑</div>
						<div className="cube-face cf-back">π</div>
						<div className="cube-face cf-right">∫</div>
						<div className="cube-face cf-left">√</div>
						<div className="cube-face cf-top">Δ</div>
						<div className="cube-face cf-bottom">∞</div>
					</div>
				</div>

				<div className="hero-shape hero-shape-2">
					<div className="tri-spin" style={{ animationDuration: "24s" }}>
						<div className="tri-face tf1">f(x)</div>
						<div className="tri-face tf2">x²</div>
						<div className="tri-face tf3">≠</div>
						<div className="tri-face tf4">∀</div>
						<div className="tri-face tf5">±</div>
						<div className="tri-face tf6">≤</div>
					</div>
				</div>

				<div className="hero-shape hero-shape-3">
					<div
						className="cube"
						style={{ animationDuration: "35s", animationDirection: "reverse" }}
					>
						<div className="cube-face center-face cf-front">sin</div>
						<div className="cube-face center-face cf-back">cos</div>
						<div className="cube-face center-face cf-right">tg</div>
						<div className="cube-face center-face cf-left">ctg</div>
						<div className="cube-face center-face cf-top">x</div>
						<div className="cube-face center-face cf-bottom">y</div>
					</div>
				</div>
			</div>

			<FloatingMath />
		</div>
	);
};

export default MathBackground;
