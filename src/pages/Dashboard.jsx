import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
	ref as dbRef,
	onValue,
	set,
	remove,
	update,
	push,
} from "firebase/database";
import { ref as storageRef, deleteObject, listAll } from "firebase/storage";
import { auth, database, storage } from "../firebase";
import MathBackground from "../components/MathBackground";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import Swal from "sweetalert2";

const TUTOR_EMAIL = "dawidchrzaszcz64@gmail.com";

const Dashboard = () => {
	const navigate = useNavigate();
	const { currentUser } = useAuth();

	const [screenshots, setScreenshots] = useState([]);
	const [students, setStudents] = useState([]);
	const [selectedStudent, setSelectedStudent] = useState(null);

	const [previewImage, setPreviewImage] = useState(null);
	const [zoomScale, setZoomScale] = useState(1);

	const [activeTab, setActiveTab] = useState("gallery");
	const [managementFilter, setManagementFilter] = useState("pending");

	const [groups, setGroups] = useState([]);
	const [selectedForGroup, setSelectedForGroup] = useState([]);
	const [groupName, setGroupName] = useState("");
	const [activeStudentGallery, setActiveStudentGallery] = useState(null);
	const isTutor = currentUser?.email === TUTOR_EMAIL;

	useEffect(() => {
		if (currentUser && !isTutor) {
			const userRef = dbRef(database, `users/${currentUser.uid}`);
			update(userRef, { email: currentUser.email }).catch(console.error);
		}
	}, [currentUser, isTutor]);

	useEffect(() => {
		if (!currentUser) return;
		const groupsRef = dbRef(database, "groups");
		const unsubscribe = onValue(groupsRef, (snapshot) => {
			if (snapshot.exists()) {
				const data = snapshot.val();
				setGroups(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
			} else {
				setGroups([]);
			}
		});
		return () => unsubscribe();
	}, [currentUser]);

	useEffect(() => {
		if (!currentUser) return;
		let targetUid = null;
		if (isTutor && selectedStudent) {
			targetUid = selectedStudent.uid;
		} else if (!isTutor) {
			targetUid = activeStudentGallery || currentUser.uid;
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
					.map((key) => ({ id: key, ...data[key] }))
					.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
				setScreenshots(loadedScreenshots);
			} else {
				setScreenshots([]);
			}
		});

		return () => unsubscribe();
	}, [currentUser, isTutor, selectedStudent, activeStudentGallery]);

	useEffect(() => {
		if (!currentUser || !isTutor) return;

		const usersRef = dbRef(database, "users");
		const unsubscribe = onValue(usersRef, (snapshot) => {
			if (snapshot.exists()) {
				const data = snapshot.val();
				const loadedStudents = Object.keys(data)
					.map((key) => ({
						uid: key,
						...data[key],
					}))
					.filter((user) => user.email !== TUTOR_EMAIL);

				setStudents(loadedStudents);
			} else {
				setStudents([]);
			}
		});

		return () => unsubscribe();
	}, [currentUser, isTutor]);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate("/login");
		} catch (error) {
			console.error("Błąd podczas wylogowywania:", error);
		}
	};

	const toggleApproval = (uid, currentStatus) => {
		const userRef = dbRef(database, `users/${uid}`);
		update(userRef, { isApproved: !currentStatus }).catch((err) =>
			console.error("Błąd aktualizacji statusu:", err),
		);
	};

	const deleteStudent = (uid) => {
		Swal.fire({
			title: "Odrzucenie ucznia",
			text: "Czy na pewno chcesz usunąć to konto? Zostanie również trwale usunięta cała historia jego tablicy oraz wszystkie pliki i zrzuty ekranu.",
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#ef4444",
			confirmButtonText: "Usuń całkowicie",
			cancelButtonText: "Anuluj",
		}).then(async (result) => {
			if (result.isConfirmed) {
				try {
					await remove(dbRef(database, `users/${uid}`));
					await remove(dbRef(database, `rooms/${uid}`));

					const screenshotsRef = storageRef(
						storage,
						`rooms/${uid}/screenshots`,
					);
					try {
						const { items } = await listAll(screenshotsRef);
						const deletePromises = items.map((itemRef) =>
							deleteObject(itemRef),
						);
						await Promise.all(deletePromises);
					} catch (storageErr) {
						console.warn(
							"Brak zrzutów do usunięcia lub błąd Storage:",
							storageErr,
						);
					}

					const uploadsRef = storageRef(storage, `rooms/${uid}/uploads`);
					try {
						const { items } = await listAll(uploadsRef);
						const deletePromises = items.map((itemRef) =>
							deleteObject(itemRef),
						);
						await Promise.all(deletePromises);
					} catch (storageErr) {
						console.warn("Brak wklejonych obrazków do usunięcia:", storageErr);
					}

					Swal.fire({
						toast: true,
						position: "top-end",
						icon: "success",
						title: "Konto i wszystkie dane zostały trwale usunięte.",
						showConfirmButton: false,
						timer: 4000,
					});
				} catch (error) {
					console.error("Błąd podczas kaskadowego usuwania ucznia:", error);
					Swal.fire({
						toast: true,
						position: "top-end",
						icon: "error",
						title: "Błąd podczas usuwania. Sprawdź konsolę.",
						showConfirmButton: false,
						timer: 4000,
					});
				}
			}
		});
	};

	const handleDeleteLesson = async (shotId, shotUrl) => {
		Swal.fire({
			title: "Usuwanie zrzutu",
			text: "Czy trwale usunąć zrzut ekranu z historii?",
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#ef4444",
			confirmButtonText: "Usuń",
			cancelButtonText: "Anuluj",
		}).then(async (result) => {
			if (result.isConfirmed) {
				const targetUid = selectedStudent
					? selectedStudent.uid
					: currentUser.uid;
				try {
					const shotDbRef = dbRef(
						database,
						`rooms/${targetUid}/screenshots/${shotId}`,
					);
					await remove(shotDbRef);
					const shotStorageRef = storageRef(storage, shotUrl);
					await deleteObject(shotStorageRef);
					Swal.fire({
						toast: true,
						position: "top-end",
						icon: "success",
						title: "Usunięto zrzut",
						showConfirmButton: false,
						timer: 4000,
					});
				} catch (error) {
					console.error("Błąd podczas usuwania lekcji:", error);
				}
			}
		});
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
			window.open(url, "_blank");
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
		if (screenshots.length === 0)
			return (
				<div className="gallery-placeholder">
					<p>Brak zapisanych zajęć.</p>
				</div>
			);
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

	const renderManagementTable = () => {
		const filteredStudents = students.filter((s) =>
			managementFilter === "pending" ? !s.isApproved : s.isApproved,
		);

		return (
			<div className="management-container">
				<div
					className="management-tabs"
					style={{ display: "flex", gap: "10px", marginBottom: "20px" }}
				>
					<button
						className={`btn-filter ${managementFilter === "pending" ? "active" : ""}`}
						onClick={() => setManagementFilter("pending")}
					>
						Oczekujący ({students.filter((s) => !s.isApproved).length})
					</button>
					<button
						className={`btn-filter ${managementFilter === "approved" ? "active" : ""}`}
						onClick={() => setManagementFilter("approved")}
					>
						Zatwierdzeni ({students.filter((s) => s.isApproved).length})
					</button>
				</div>

				<div className="table-responsive">
					<table className="users-table">
						<thead>
							<tr>
								<th>Imię</th>
								<th>Email</th>
								<th>Status</th>
								<th>Akcja</th>
							</tr>
						</thead>
						<tbody>
							{filteredStudents.length === 0 ? (
								<tr>
									<td colSpan="4" className="empty-state">
										{managementFilter === "pending"
											? "Brak oczekujących uczniów."
											: "Brak zatwierdzonych uczniów."}
									</td>
								</tr>
							) : (
								filteredStudents.map((student) => {
									return (
										<tr key={student.uid}>
											<td className="fw-bold">
												{student.name || "Brak imienia"}
											</td>
											<td>{student.email}</td>
											<td>
												<span
													className={`status-badge ${student.isApproved ? "approved" : "pending"}`}
												>
													{student.isApproved ? "Zatwierdzony" : "Oczekujący"}
												</span>
											</td>
											<td>
												<div style={{ display: "flex", gap: "8px" }}>
													<button
														onClick={() =>
															toggleApproval(student.uid, student.isApproved)
														}
														className={`btn-action ${student.isApproved ? "btn-block" : "btn-approve"}`}
													>
														{student.isApproved ? "Zablokuj" : "Zatwierdź"}
													</button>
													<button
														onClick={() => deleteStudent(student.uid)}
														className="btn-action btn-delete"
													>
														Odrzuć
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		);
	};

	return (
		<>
			<MathBackground />
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
								<h2 className="section-title">Narzędzia</h2>

								<div
									className="tutor-tabs"
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "10px",
										marginBottom: "20px",
									}}
								>
									<button
										className={`student-item ${activeTab === "manage" ? "active" : ""}`}
										onClick={() => {
											setActiveTab("manage");
											setSelectedStudent(null);
										}}
									>
										👥 Zarządzaj uczniami
									</button>
									<button
										className={`student-item ${activeTab === "gallery" ? "active" : ""}`}
										onClick={() => setActiveTab("gallery")}
									>
										🖼️ Galerie zrzutów
									</button>
									<button
										className={`student-item ${activeTab === "groups" ? "active" : ""}`}
										onClick={() => {
											setActiveTab("groups");
											setSelectedStudent(null);
										}}
									>
										🏫 Zarządzaj Grupami
									</button>
								</div>

								{activeTab === "gallery" && (
									<>
										<h2
											className="section-title"
											style={{ fontSize: "1.2rem", marginTop: "20px" }}
										>
											Wybierz ucznia / grupę
										</h2>
										<ul className="student-list">
											{students
												.filter((s) => s.isApproved)
												.map((student) => (
													<li
														key={student.uid}
														className={`student-item ${selectedStudent?.uid === student.uid ? "active" : ""}`}
														onClick={() => setSelectedStudent(student)}
													>
														👤 {student.name || student.email}
													</li>
												))}

											{groups.length > 0 && (
												<div
													style={{
														color: "var(--muted)",
														fontSize: "0.8rem",
														marginTop: "15px",
														marginBottom: "5px",
														textTransform: "uppercase",
														letterSpacing: "1px",
													}}
												>
													Grupy Zespołowe
												</div>
											)}
											{groups.map((group) => (
												<li
													key={group.id}
													className={`student-item ${selectedStudent?.uid === group.id ? "active" : ""}`}
													onClick={() =>
														setSelectedStudent({
															uid: group.id,
															name: group.name,
															email: "Katalog grupowy",
															isGroup: true,
														})
													}
												>
													🏫 {group.name}
												</li>
											))}
										</ul>
										{students.length === 0 && groups.length === 0 && (
											<p
												className="gallery-placeholder"
												style={{ padding: "20px", border: "none" }}
											>
												Brak uczniów i grup.
											</p>
										)}
									</>
								)}
							</aside>

							<section className="student-details-container">
								{/* ZAKŁADKA 1: ZARZĄDZANIE UCZNIAMI */}
								{activeTab === "manage" && (
									<section
										className="dashboard-card users-card"
										style={{
											background: "var(--glass-bg)",
											padding: "30px",
											borderRadius: "var(--r2)",
											border: "1px solid var(--glass-brd)",
										}}
									>
										<h2 className="section-title">
											Zarządzanie kontami uczniów
										</h2>
										<p style={{ color: "var(--muted)", marginBottom: "20px" }}>
											Zatwierdzaj nowych uczniów, aby dać im dostęp do tablicy.
										</p>
										{renderManagementTable()}
									</section>
								)}

								{/* ZAKŁADKA 2: ZARZĄDZANIE GRUPAMI (KREATOR GRUP) */}
								{activeTab === "groups" && (
									<section
										className="dashboard-card users-card"
										style={{
											background: "var(--glass-bg)",
											padding: "30px",
											borderRadius: "var(--r2)",
											border: "1px solid var(--glass-brd)",
										}}
									>
										<h2 className="section-title">Kreator Grup</h2>
										<p
											style={{
												color: "var(--muted)",
												marginBottom: "20px",
											}}
										>
											Utwórz wspólną tablicę. Uczniowie w tej grupie zobaczą
											przycisk dołączenia, a ich zrzuty wpadną do jednego,
											wspólnego folderu.
										</p>

										<input
											type="text"
											placeholder="Nazwa grupy (np. Klasa 8a - Wtorek 16:00)"
											value={groupName}
											onChange={(e) => setGroupName(e.target.value)}
											style={{
												width: "100%",
												padding: "15px",
												borderRadius: "12px",
												background: "rgba(0,0,0,0.2)",
												border: "1px solid var(--glass-brd)",
												color: "#fff",
												fontSize: "1rem",
												marginBottom: "15px",
												outline: "none",
											}}
										/>

										<div
											className="student-list"
											style={{
												marginBottom: "20px",
												background: "rgba(0,0,0,0.2)",
												padding: "15px",
												borderRadius: "12px",
												maxHeight: "200px",
												overflowY: "auto",
											}}
										>
											{students
												.filter((s) => s.isApproved)
												.map((student) => (
													<label
														key={student.uid}
														className="student-item"
														style={{
															display: "flex",
															alignItems: "center",
															gap: "15px",
															cursor: "pointer",
															border: "none",
															background: "transparent",
														}}
													>
														<input
															type="checkbox"
															style={{
																width: "18px",
																height: "18px",
																accentColor: "var(--cyan)",
															}}
															checked={selectedForGroup.includes(student.uid)}
															onChange={(e) => {
																if (e.target.checked)
																	setSelectedForGroup((prev) => [
																		...prev,
																		student.uid,
																	]);
																else
																	setSelectedForGroup((prev) =>
																		prev.filter((id) => id !== student.uid),
																	);
															}}
														/>
														<span style={{ fontSize: "1rem", color: "#fff" }}>
															{student.name || student.email}
														</span>
													</label>
												))}
										</div>

										<button
											onClick={async () => {
												if (
													!groupName.trim() ||
													selectedForGroup.length === 0
												) {
													Swal.fire({
														toast: true,
														position: "top-end",
														icon: "warning",
														title: "Podaj nazwę i wybierz uczniów.",
														showConfirmButton: false,
														timer: 4000,
													});
													return;
												}
												const newGroupId = push(dbRef(database, "dummy")).key;
												const participants = {};
												selectedForGroup.forEach(
													(uid) => (participants[uid] = true),
												);

												await set(dbRef(database, `groups/${newGroupId}`), {
													name: groupName,
													participants,
												});

												setGroupName("");
												setSelectedForGroup([]);
												Swal.fire({
													toast: true,
													position: "top-end",
													icon: "success",
													title: "Grupa utworzona!",
													showConfirmButton: false,
													timer: 4000,
												});
											}}
											className="btn-join-room"
											style={{ width: "100%" }}
										>
											Utwórz i przypisz grupę
										</button>
									</section>
								)}

								{/* ZAKŁADKA 3: GALERIA */}
								{activeTab === "gallery" &&
									(selectedStudent ? (
										<>
											<div
												className="welcome-section"
												style={{ marginBottom: "40px" }}
											>
												<h1
													style={{ fontSize: "1.8rem", marginBottom: "10px" }}
												>
													{selectedStudent.name || selectedStudent.email}
												</h1>
												<p style={{ marginBottom: "20px" }}>
													Przeglądaj historię lekcji lub dołącz do aktywnej
													tablicy {selectedStudent.isGroup ? "grupy" : "ucznia"}
													.
												</p>
												<button
													onClick={() =>
														navigate(`/room/${selectedStudent.uid}`)
													}
													className="btn-join-room"
												>
													Rozpocznij lekcję
												</button>
											</div>

											<section className="history-section">
												<h2 className="section-title">Historia zajęć</h2>
												{renderGallery()}
											</section>
										</>
									) : (
										<div className="welcome-section">
											<h1>Galerie uczniów i grup</h1>
											<p>
												Wybierz ucznia lub grupę z listy po lewej stronie, aby
												wyświetlić zrzuty ekranu i dołączyć do pokoju.
											</p>
										</div>
									))}
							</section>
						</div>
					) : (
						<>
							<section className="welcome-section">
								<h1>Panel Ucznia</h1>
								<p style={{ marginBottom: "30px" }}>
									Witaj w wirtualnej przestrzeni do nauki matematyki.
								</p>

								<div
									style={{
										display: "flex",
										gap: "20px",
										justifyContent: "center",
										flexWrap: "wrap",
									}}
								>
									<button
										onClick={() => navigate(`/room/${currentUser.uid}`)}
										className="btn-join-room"
									>
										👤 Moja Tablica Prywatna
									</button>

									{groups
										.filter(
											(g) => g.participants && g.participants[currentUser.uid],
										)
										.map((group) => (
											<button
												key={group.id}
												onClick={() => navigate(`/room/${group.id}`)}
												className="btn-join-room"
												style={{
													background:
														"linear-gradient(90deg, #ef4444, #f97316)",
													boxShadow: "0 5px 25px rgba(239, 68, 68, 0.4)",
												}}
											>
												🏫 Grupa: {group.name}
											</button>
										))}
								</div>
							</section>

							<section className="history-section">
								<h2 className="section-title">Historia zajęć</h2>

								{/* Zakładki do przełączania się między galerią prywatną a grupową */}
								<div
									className="management-tabs"
									style={{
										display: "flex",
										gap: "10px",
										marginBottom: "20px",
										flexWrap: "wrap",
									}}
								>
									<button
										className={`btn-filter ${!activeStudentGallery || activeStudentGallery === currentUser.uid ? "active" : ""}`}
										onClick={() => setActiveStudentGallery(currentUser.uid)}
									>
										👤 Moje Prywatne
									</button>
									{groups
										.filter(
											(g) => g.participants && g.participants[currentUser.uid],
										)
										.map((group) => (
											<button
												key={group.id}
												className={`btn-filter ${activeStudentGallery === group.id ? "active" : ""}`}
												onClick={() => setActiveStudentGallery(group.id)}
											>
												🏫 {group.name}
											</button>
										))}
								</div>

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
								alt="Podgląd"
								style={{ width: `${zoomScale * 100}%`, height: "auto" }}
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
