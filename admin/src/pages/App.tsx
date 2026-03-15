import { Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { RedirectListPage } from './RedirectListPage';
import { OrphanRedirectPage } from './OrphanRedirectPage';

const App = () => {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="redirects" element={<RedirectListPage />} />
      <Route path="orphans" element={<OrphanRedirectPage />} />
    </Routes>
  );
};

export { App };
