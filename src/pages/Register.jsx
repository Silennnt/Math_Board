import React, { useState } from "react";
import { auth, database } from "../firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";
import MathBackground from "../components/MathBackground";

const Register = () => {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const navigate = useNavigate();

	const handleRegister = async (e) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const userCredential = await createUserWithEmailAndPassword(
				auth,
				email,
				password,
			);
			const user = userCredential.user;

			await updateProfile(user, {
				displayName: name,
			});

			const userRef = ref(database, `users/${user.uid}`);
			await set(userRef, {
				email: user.email,
				name: name,
				role: "student",
				isApproved: false,
				createdAt: new Date().toISOString(),
			});

			alert(
				"Konto zostało utworzone. Poczekaj na zatwierdzenie przez nauczyciela.",
			);
			navigate("/login");
		} catch (err) {
			console.error("Błąd rejestracji:", err);
			setError("Wystąpił błąd podczas rejestracji. Sprawdź poprawność danych.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<MathBackground />
			<div className="login-container">
				<div className="login-card">
					<h1 className="login-title">Rejestracja</h1>
					<p className="login-subtitle">Konto ucznia</p>

					{error && <div className="login-error">{error}</div>}

					<form onSubmit={handleRegister} className="login-form">
						<div className="input-group">
							<label htmlFor="name">Jak się nazywasz?</label>
							<input
								type="text"
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								placeholder="Wpisz swoje imię i nazwisko"
							/>
						</div>

						<div className="input-group">
							<label htmlFor="email">Adres e-mail</label>
							<input
								type="email"
								id="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								placeholder="Wpisz adres e-mail"
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
								minLength="6"
								placeholder="Minimum 6 znaków"
							/>
						</div>

						<button type="submit" disabled={isLoading} className="login-btn">
							{isLoading ? "Tworzenie konta..." : "Zarejestruj się"}
						</button>

						<p
							className="auth-switch"
							style={{ marginTop: "15px", textAlign: "center" }}
						>
							Masz już konto?{" "}
							<Link to="/login" style={{ color: "var(--cyan)" }}>
								Zaloguj się
							</Link>
						</p>
					</form>
				</div>
			</div>
		</>
	);
};

export default Register;
