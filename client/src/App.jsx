import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Explore from './pages/Explore';
import CauseDetail from './pages/CauseDetail';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';
import Claim from './pages/Claim';
import Dashboard from './pages/Dashboard';
import CreateCause from './pages/CreateCause';
import SafetyDocs from './pages/SafetyDocs';
import AgentDocs from './pages/AgentDocs';
import Leaderboard from './pages/Leaderboard';
import Activity from './pages/Activity';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="explore" element={<Explore />} />
            <Route path="causes/:slug" element={<CauseDetail />} />
            <Route path="causes/new" element={<CreateCause />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="claim/:code" element={<Claim />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="docs/safety" element={<SafetyDocs />} />
            <Route path="docs/agents" element={<AgentDocs />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="activity" element={<Activity />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
