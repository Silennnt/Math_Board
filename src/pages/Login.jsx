import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, get, set, update } from "firebase/database";
import { auth, database } from "../firebase";
import MathBackground from "../components/MathBackground";
import "./Login.css";

const Login = () => {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleLogin = async (e) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const userCredential = await signInWithEmailAndPassword(
				auth,
				email,
				password,
			);
			const user = userCredential.user;

			if (user.email === "dawidchrzaszcz64@gmail.com") {
				const adminRef = ref(database, `users/${user.uid}`);
				const adminSnap = await get(adminRef);

				if (!adminSnap.exists()) {
					await set(adminRef, {
						email: user.email,
						name: "Dawid Chrząszcz",
						role: "tutor",
						isApproved: true,
						createdAt: new Date().toISOString(),
					});
				} else {
					await update(adminRef, { name: "Dawid Chrząszcz" });
				}
				navigate("/dashboard");
				return;
			}

			const userRef = ref(database, `users/${user.uid}`);
			const snapshot = await get(userRef);

			if (snapshot.exists()) {
				const userData = snapshot.val();

				if (userData.isApproved === true) {
					navigate("/dashboard");
				} else {
					await signOut(auth);
					setError("Twoje konto oczekuje na zatwierdzenie przez nauczyciela.");
				}
			} else {
				await signOut(auth);
				setError(
					"Nie znaleziono pełnego profilu. Skontaktuj się z nauczycielem.",
				);
			}
		} catch (err) {
			console.error("Szczegóły błędu:", err);

			if (
				err.code === "auth/invalid-credential" ||
				err.code === "auth/user-not-found" ||
				err.code === "auth/wrong-password"
			) {
				setError("Nieprawidłowy adres e-mail lub hasło.");
			} else if (err.message && err.message.includes("Permission denied")) {
				await signOut(auth);
				setError("Twoje konto oczekuje na zatwierdzenie.");
			} else {
				setError(`Wystąpił błąd: ${err.message}`);
			}
		} finally {
			setIsLoading(false);
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
						<button type="submit" disabled={isLoading} className="login-btn">
							{isLoading ? "Logowanie..." : "Zaloguj się"}
						</button>
						<p
							className="auth-switch"
							style={{ marginTop: "15px", textAlign: "center" }}
						>
							Nie masz konta?{" "}
							<Link to="/register" style={{ color: "var(--cyan)" }}>
								Zarejestruj się
							</Link>
						</p>
					</form>
				</div>
			</div>
		</>
	);
};

export default Login;
