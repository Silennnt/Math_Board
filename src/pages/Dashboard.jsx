import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, database } from "../firebase";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

const Dashboard = () => {
	const navigate = useNavigate();
	const { currentUser } = useAuth();
	const [screenshots, setScreenshots] = useState([]);

	useEffect(() => {
		if (!currentUser) return;

		const screenshotsRef = ref(
			database,
			`rooms/${currentUser.uid}/screenshots`,
		);
		const unsubscribe = onValue(screenshotsRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				const loadedScreenshots = Object.keys(data)
					.map((key) => ({
						id: key,
						...data[key],
					}))
					.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

				setScreenshots(loadedScreenshots);
			} else {
				setScreenshots([]);
			}
		});

		return () => unsubscribe();
	}, [currentUser]);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate("/login");
		} catch (error) {
			console.error("Błąd podczas wylogowywania:", error);
		}
	};

	const joinRoom = () => {
		if (currentUser) {
			navigate(`/room/${currentUser.uid}`);
		}
	};

	const formatDate = (isoString) => {
		const date = new Date(isoString);
		return date.toLocaleDateString("pl-PL", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="dashboard-container">
			<header className="dashboard-header">
				<div className="user-info">
					<span className="user-email">{currentUser?.email}</span>
					<span className="user-role">Konto Ucznia</span>
				</div>
				<button onClick={handleLogout} className="btn-logout">
					Wyloguj się
				</button>
			</header>

			<main className="dashboard-main">
				<section className="welcome-section">
					<h1>Panel Ucznia</h1>
					<p>
						Witaj w wirtualnej przestrzeni do nauki matematyki. Twoja tablica
						jest gotowa.
					</p>
					<button onClick={joinRoom} className="btn-join-room">
						Dołącz do aktywnej lekcji
					</button>
				</section>

				<section className="history-section">
					<h2>Historia zajęć</h2>

					{screenshots.length > 0 ? (
						<div className="gallery-grid">
							{screenshots.map((shot) => (
								<div key={shot.id} className="gallery-card">
									<div className="gallery-image-wrapper">
										<img
											src={shot.url}
											alt="Zrzut tablicy z lekcji"
											loading="lazy"
										/>
									</div>
									<div className="gallery-info">
										<span>{formatDate(shot.createdAt)}</span>
										<a
											href={shot.url}
											target="_blank"
											rel="noopener noreferrer"
											className="btn-download"
										>
											Pobierz
										</a>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="gallery-placeholder">
							<p>
								Po zakończonych zajęciach pojawią się tutaj zrzuty ekranu z
								zapisem rozwiązanych zadań.
							</p>
						</div>
					)}
				</section>
			</main>
		</div>
	);
};

export default Dashboard;
