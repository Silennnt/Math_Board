import React, { useMemo } from "react";
import "./FloatingMath.css";

const formulas = [
	"E = mc²",
	"a² + b² = c²",
	"sin²(α) + cos²(α) = 1",
	"∫ f(x) dx",
	"lim_{x→∞} (1+1/x)ˣ = e",
	"Δ = b² - 4ac",
	"e^(iπ) + 1 = 0",
	"f'(x) = nxⁿ⁻¹",
	"V = 4/3πr³",
	"P(A|B) = P(B|A)P(A)/P(B)",
	"∑ 1/n² = π²/6",
	"log(xy) = log(x) + log(y)",
	"∇ × E = -∂B/∂t",
	"A = πr²",
	"x = (-b ± √Δ) / 2a",
	"F = G(m₁m₂)/r²",
	"x² + y² = r²",
];

const FloatingMath = () => {
	const items = useMemo(() => {
		return Array.from({ length: 20 }).map((_, i) => {
			const formula = formulas[Math.floor(Math.random() * formulas.length)];

			const startX = Math.random() * 100;
			const endX = startX + (Math.random() * 40 - 20);

			const isGoingUp = Math.random() > 0.5;
			const startY = isGoingUp ? 110 : -10;
			const endY = isGoingUp ? -10 : 110;

			const rotStart = Math.random() * 90 - 45;
			const rotEnd = rotStart + (Math.random() * 180 - 90);

			const dur = 20 + Math.random() * 40;
			const delay = -(Math.random() * dur);
			const size = 0.8 + Math.random() * 1.5;
			const opacity = 0.05 + Math.random() * 0.15;

			return {
				id: i,
				formula,
				startX,
				endX,
				startY,
				endY,
				rotStart,
				rotEnd,
				dur,
				delay,
				size,
				opacity,
			};
		});
	}, []);

	return (
		<div id="global-math-container">
			{items.map((item) => (
				<div
					key={item.id}
					className="math-float"
					style={{
						"--startX": `${item.startX}vw`,
						"--endX": `${item.endX}vw`,
						"--startY": `${item.startY}vh`,
						"--endY": `${item.endY}vh`,
						"--rotStart": `${item.rotStart}deg`,
						"--rotEnd": `${item.rotEnd}deg`,
						"--dur": `${item.dur}s`,
						"--delay": `${item.delay}s`,
						"--size": `${item.size}rem`,
						"--base-opacity": item.opacity,
					}}
				>
					{item.formula}
				</div>
			))}
		</div>
	);
};

export default FloatingMath;
