import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { auth, database } from "../firebase";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

const TUTOR_EMAIL = "dawidchrzaszcz64@gmail.com";

const Dashboard = () => {
	const navigate = useNavigate();
	const { currentUser } = useAuth();

	const [screenshots, setScreenshots] = useState([]);
	const [students, setStudents] = useState([]);
	const [selectedStudent, setSelectedStudent] = useState(null);

	const isTutor = currentUser?.email === TUTOR_EMAIL;

	useEffect(() => {
		if (currentUser && !isTutor) {
			const userRef = ref(database, `users/${currentUser.uid}`);
			set(userRef, { email: currentUser.email }).catch((err) =>
				console.error("Błąd zapisu danych użytkownika:", err),
			);
		}
	}, [currentUser, isTutor]);

	useEffect(() => {
		if (currentUser && isTutor) {
			const usersRef = ref(database, "users");
			const unsubscribe = onValue(usersRef, (snapshot) => {
				const data = snapshot.val();
				if (data) {
					const studentsList = Object.keys(data).map((uid) => ({
						uid,
						email: data[uid].email,
					}));
					setStudents(studentsList);
				} else {
					setStudents([]);
				}
			});
			return () => unsubscribe();
		}
	}, [currentUser, isTutor]);

	useEffect(() => {
		if (!currentUser) return;

		let targetUid = null;
		if (isTutor && selectedStudent) {
			targetUid = selectedStudent.uid;
		} else if (!isTutor) {
			targetUid = currentUser.uid;
		}

		if (!targetUid) {
			setScreenshots([]);
			return;
		}

		const screenshotsRef = ref(database, `rooms/${targetUid}/screenshots`);
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
	}, [currentUser, isTutor, selectedStudent]);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate("/login");
		} catch (error) {
			console.error("Błąd podczas wylogowywania:", error);
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
					<span className="user-role">
						{isTutor ? "Konto Prowadzącego" : "Konto Ucznia"}
					</span>
				</div>
				<button onClick={handleLogout} className="btn-logout">
					Wyloguj się
				</button>
			</header>

			<main className="dashboard-main">
				{isTutor ? (
					<div className="tutor-layout">
						<aside className="student-list-container">
							<h2 className="section-title">Twoi Uczniowie</h2>
							{students.length > 0 ? (
								<ul className="student-list">
									{students.map((student) => (
										<li
											key={student.uid}
											className={`student-item ${selectedStudent?.uid === student.uid ? "active" : ""}`}
											onClick={() => setSelectedStudent(student)}
										>
											{student.email}
										</li>
									))}
								</ul>
							) : (
								<p
									className="gallery-placeholder"
									style={{ padding: "20px", border: "none" }}
								>
									Brak aktywnych uczniów.
								</p>
							)}
						</aside>

						<section className="student-details-container">
							{selectedStudent ? (
								<>
									<div
										className="welcome-section"
										style={{ marginBottom: "40px" }}
									>
										<h1 style={{ fontSize: "1.8rem", marginBottom: "10px" }}>
											{selectedStudent.email}
										</h1>
										<p style={{ marginBottom: "20px" }}>
											Przeglądaj historię lekcji lub dołącz do aktywnej tablicy
											ucznia.
										</p>
										<button
											onClick={() => navigate(`/room/${selectedStudent.uid}`)}
											className="btn-join-room"
										>
											Rozpocznij lekcję z tym uczniem
										</button>
									</div>

									<section className="history-section">
										<h2 className="section-title">Historia zajęć</h2>
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
												<p>Brak zapisanych zajęć dla tego ucznia.</p>
											</div>
										)}
									</section>
								</>
							) : (
								<div className="welcome-section">
									<h1>Panel Korepetytora</h1>
									<p>
										Wybierz ucznia z listy po lewej stronie, aby wyświetlić jego
										profil.
									</p>
								</div>
							)}
						</section>
					</div>
				) : (
					<>
						<section className="welcome-section">
							<h1>Panel Ucznia</h1>
							<p>
								Witaj w wirtualnej przestrzeni do nauki matematyki. Twoja
								tablica jest gotowa.
							</p>
							<button
								onClick={() => navigate(`/room/${currentUser.uid}`)}
								className="btn-join-room"
							>
								Dołącz do aktywnej lekcji
							</button>
						</section>

						<section className="history-section">
							<h2 className="section-title">Historia zajęć</h2>
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
					</>
				)}
			</main>
		</div>
	);
};

export default Dashboard;
