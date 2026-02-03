import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Explore from './pages/Explore';
import CauseDetail from './pages/CauseDetail';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Claim from './pages/Claim';
import Dashboard from './pages/Dashboard';
import CreateCause from './pages/CreateCause';

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
            <Route path="claim/:code" element={<Claim />} />
            <Route path="dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
