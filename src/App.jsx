import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";

const Dashboard = () => (
	<div style={{ padding: "2rem" }}>Panel Ucznia / Korepetytora</div>
);
const Room = () => (
	<div style={{ padding: "2rem" }}>
		Przestrzeń robocza tablicy interaktywnej
	</div>
);

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Navigate to="/login" replace />} />
				<Route path="/login" element={<Login />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/room/:roomId" element={<Room />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
