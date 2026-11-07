import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { ref as dbRef, onValue, set, remove } from "firebase/database";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { auth, database, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

const TUTOR_EMAIL = "dawidchrzaszcz64@gmail.com";

const Dashboard = () => {
	const navigate = useNavigate();
	const { currentUser } = useAuth();

	const [screenshots, setScreenshots] = useState([]);
	const [students, setStudents] = useState([]);
	const [selectedStudent, setSelectedStudent] = useState(null);

	const [previewImage, setPreviewImage] = useState(null);
	const [zoomScale, setZoomScale] = useState(1);

	const isTutor = currentUser?.email === TUTOR_EMAIL;

	useEffect(() => {
		if (currentUser && !isTutor) {
			const userRef = dbRef(database, `users/${currentUser.uid}`);
			set(userRef, { email: currentUser.email }).catch(console.error);
		}
	}, [currentUser, isTutor]);

	useEffect(() => {
		if (currentUser && isTutor) {
			const usersRef = dbRef(database, "users");
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

		const screenshotsDbRef = dbRef(database, `rooms/${targetUid}/screenshots`);
		const unsubscribe = onValue(screenshotsDbRef, (snapshot) => {
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

	const handleDeleteLesson = async (shotId, shotUrl) => {
		const confirmDelete = window.confirm(
			"Czy na pewno chcesz trwale usunąć ten zrzut ekranu z historii?",
		);
		if (!confirmDelete) return;

		const targetUid = selectedStudent ? selectedStudent.uid : currentUser.uid;

		try {
			const shotDbRef = dbRef(
				database,
				`rooms/${targetUid}/screenshots/${shotId}`,
			);
			await remove(shotDbRef);

			const shotStorageRef = storageRef(storage, shotUrl);
			await deleteObject(shotStorageRef);
		} catch (error) {
			console.error("Błąd podczas usuwania lekcji:", error);
			alert("Wystąpił błąd podczas usuwania. Sprawdź konsolę.");
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

	// Wymuszenie pobierania pliku na dysk
	const handleForceDownload = async (url, dateStr, e) => {
		e.preventDefault();
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const objectUrl = window.URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = objectUrl;
			link.download = `Tablica_${dateStr.replace(/[., :\/\\]/g, "_")}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(objectUrl);
		} catch (error) {
			console.error(
				"Wystąpił problem z pobieraniem w tle (CORS), otwieram w nowej karcie:",
				error,
			);
			window.open(url, "_blank"); // Zabezpieczenie na wypadek blokady CORS
		}
	};

	const openPreview = (url) => {
		setPreviewImage(url);
		setZoomScale(1);
		document.body.style.overflow = "hidden";
	};

	const closePreview = () => {
		setPreviewImage(null);
		setZoomScale(1);
		document.body.style.overflow = "auto";
	};

	const handleZoomIn = () => setZoomScale((prev) => Math.min(prev + 0.5, 4));
	const handleZoomOut = () => setZoomScale((prev) => Math.max(prev - 0.5, 0.5));

	const renderGallery = () => {
		if (screenshots.length === 0) {
			return (
				<div className="gallery-placeholder">
					<p>Brak zapisanych zajęć.</p>
				</div>
			);
		}

		return (
			<div className="gallery-grid">
				{screenshots.map((shot) => {
					const formattedDate = formatDate(shot.createdAt);
					return (
						<div key={shot.id} className="gallery-card">
							<div
								className="gallery-image-wrapper"
								onClick={() => openPreview(shot.url)}
							>
								<img
									src={shot.url}
									alt="Zrzut tablicy z lekcji"
									loading="lazy"
								/>
								<div className="gallery-image-overlay">
									<span>🔍 Kliknij, aby powiększyć</span>
								</div>
							</div>
							<div className="gallery-info">
								<span>{formattedDate}</span>
								<div className="gallery-actions">
									<button
										onClick={() => openPreview(shot.url)}
										className="btn-action btn-preview"
									>
										Podgląd
									</button>
									<a
										href={shot.url}
										onClick={(e) =>
											handleForceDownload(shot.url, formattedDate, e)
										}
										className="btn-action btn-download"
									>
										Pobierz
									</a>
									{isTutor && (
										<button
											onClick={() => handleDeleteLesson(shot.id, shot.url)}
											className="btn-action btn-delete"
										>
											Usuń
										</button>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<>
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
												Przeglądaj historię lekcji lub dołącz do aktywnej
												tablicy ucznia.
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
											{renderGallery()}
										</section>
									</>
								) : (
									<div className="welcome-section">
										<h1>Panel Korepetytora</h1>
										<p>
											Wybierz ucznia z listy po lewej stronie, aby wyświetlić
											jego profil.
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
								{renderGallery()}
							</section>
						</>
					)}
				</main>
			</div>

			{previewImage && (
				<div className="preview-modal-overlay" onClick={closePreview}>
					<div
						className="preview-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="preview-toolbar">
							<span className="zoom-level">
								Skala: {Math.round(zoomScale * 100)}%
							</span>
							<button
								onClick={handleZoomOut}
								className="btn-zoom"
								title="Oddal"
							>
								➖
							</button>
							<button
								onClick={handleZoomIn}
								className="btn-zoom"
								title="Przybliż"
							>
								➕
							</button>
							<button onClick={closePreview} className="btn-close-modal">
								Zamknij
							</button>
						</div>
						<div className="preview-image-container">
							<img
								src={previewImage}
								alt="Podgląd pełnoekranowy"
								style={{ transform: `scale(${zoomScale})` }}
								className="preview-img"
							/>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default Dashboard;
