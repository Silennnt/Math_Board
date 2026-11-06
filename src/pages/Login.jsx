import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import MathBackground from "../components/MathBackground";
import "./Login.css";

const Login = () => {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleLogin = async (e) => {
		e.preventDefault();
		setError("");

		try {
			await signInWithEmailAndPassword(auth, email, password);
			navigate("/dashboard");
		} catch (err) {
			setError("Nieprawidłowy adres e-mail lub hasło.");
			console.error(err);
		}
	};

	return (
		<>
			<MathBackground />
			<div className="login-container">
				<div className="login-card">
					<h1 className="login-title">Math-Board</h1>
					<p className="login-subtitle">Panel dostępowy</p>

					{error && <div className="login-error">{error}</div>}

					<form onSubmit={handleLogin} className="login-form">
						<div className="input-group">
							<label htmlFor="email">Adres e-mail</label>
							<input
								type="email"
								id="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								placeholder="uczen@domena.pl"
							/>
						</div>
						<div className="input-group">
							<label htmlFor="password">Hasło</label>
							<input
								type="password"
								id="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
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
