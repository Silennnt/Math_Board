import { useNavigate } from "react-router-dom";
import MathBackground from "../components/MathBackground";
import "./Login.css";

const Login = () => {
	const navigate = useNavigate();

	const handleLogin = (e) => {
		e.preventDefault();
		navigate("/dashboard");
	};

	return (
		<>
			<MathBackground />
			<div className="login-container">
				<div className="login-card">
					<h1 className="login-title">Math-Board</h1>
					<p className="login-subtitle">Panel dostępowy</p>
					<form onSubmit={handleLogin} className="login-form">
						<div className="input-group">
							<label htmlFor="email">Adres e-mail</label>
							<input
								type="email"
								id="email"
								required
								placeholder="uczen@domena.pl"
							/>
						</div>
						<div className="input-group">
							<label htmlFor="password">Hasło</label>
							<input
								type="password"
								id="password"
								required
								placeholder="••••••••"
							/>
						</div>
						<button type="submit" className="login-btn">
							Zaloguj się
						</button>
					</form>
				</div>
			</div>
		</>
	);
};

export default Login;
