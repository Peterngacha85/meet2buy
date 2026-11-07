import { createBrowserRouter } from 'react-router';
import { PublicLayout } from './layouts/PublicLayout.jsx';
import { SellerLayout } from './layouts/SellerLayout.jsx';
import { AdminLayout } from './layouts/AdminLayout.jsx';
import { RequireRole } from './RequireRole.jsx';
import { MallHome } from '../pages/mall/MallHome.jsx';
import { Login } from '../pages/auth/Login.jsx';
import { Register } from '../pages/auth/Register.jsx';
import { OpenStore } from '../pages/auth/OpenStore.jsx';
import { SellerOverview } from '../pages/seller/Overview.jsx';
import { AdminOverview } from '../pages/admin/Overview.jsx';
import { ComingSoon } from '../pages/ComingSoon.jsx';
import { NotFound } from '../pages/NotFound.jsx';

const soon = (title, sprint) => ({ element: <ComingSoon title={title} sprint={sprint} /> });

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <MallHome /> },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/open-store', element: <OpenStore /> },
      {
        element: <RequireRole />,
        children: [{ path: '/orders', ...soon('My orders', 6) }],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/seller',
    element: <RequireRole roles={['seller']} />,
    children: [
      {
        element: <SellerLayout />,
        children: [
          { index: true, element: <SellerOverview /> },
          { path: 'store', ...soon('Store profile', 2) },
          { path: 'products', ...soon('Products', 2) },
          { path: 'orders', ...soon('Orders', 6) },
          { path: 'payouts', ...soon('Payout settings', 2) },
          { path: 'live', ...soon('Live control', 4) },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <RequireRole roles={['admin']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminOverview /> },
          { path: 'sellers', ...soon('Sellers', 2) },
          { path: 'transactions', ...soon('Transactions', 7) },
          { path: 'payouts', ...soon('Payouts', 7) },
          { path: 'live-rooms', ...soon('Live rooms', 7) },
          { path: 'users', ...soon('Users', 7) },
          { path: 'settings', ...soon('Settings', 7) },
        ],
      },
    ],
  },
]);
