import { Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { RedirectListPage } from './RedirectListPage';

const App = () => {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="redirects" element={<RedirectListPage />} />
    </Routes>
  );
};

export { App };
