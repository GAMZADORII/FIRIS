import FireAlert from '../components/Console/FireAlert.jsx';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header/Header.jsx';
import { getSession } from '../api/client.js';

export default function MainLayout() {
  return (
    <>
      <Header user={getSession()?.account} />
      <FireAlert />
      <Outlet />
    </>
  );
}
