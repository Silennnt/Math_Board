import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Błąd podczas wylogowywania:', error);
    }
  };

  const joinRoom = () => {
   
    navigate('/room/testowa-sesja');
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="user-info">
          <span className="user-email">{currentUser?.email}</span>
          <span className="user-role">Konto Ucznia</span>
        </div>
        <button onClick={handleLogout} className="btn-logout">Wyloguj się</button>
      </header>

      <main className="dashboard-main">
        <section className="welcome-section">
          <h1>Panel Ucznia</h1>
          <p>Witaj w wirtualnej przestrzeni do nauki matematyki. Twoja tablica jest gotowa.</p>
          <button onClick={joinRoom} className="btn-join-room">
            Dołącz do aktywnej lekcji
          </button>
        </section>
        
        <section className="history-section">
          <h2>Historia zajęć</h2>
          <div className="gallery-placeholder">
            <p>Po zakończonych zajęciach pojawią się tutaj zrzuty ekranu z zapisem rozwiązanych zadań.</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;