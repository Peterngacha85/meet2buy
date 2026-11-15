import { createBrowserRouter } from 'react-router';
import { PublicLayout } from './layouts/PublicLayout.jsx';
import { SellerLayout } from './layouts/SellerLayout.jsx';
import { AdminLayout } from './layouts/AdminLayout.jsx';
import { RequireRole } from './RequireRole.jsx';
import { MallHome } from '../pages/mall/MallHome.jsx';
import { ShopPage } from '../pages/mall/ShopPage.jsx';
import { Login } from '../pages/auth/Login.jsx';
import { Register } from '../pages/auth/Register.jsx';
import { OpenStore } from '../pages/auth/OpenStore.jsx';
import { Account } from '../pages/account/Account.jsx';
import { MyOrders } from '../pages/account/MyOrders.jsx';
import { SellerOrders } from '../pages/seller/Orders.jsx';
import { SellerOverview } from '../pages/seller/Overview.jsx';
import { StoreProfile } from '../pages/seller/StoreProfile.jsx';
import { SellerProducts } from '../pages/seller/Products.jsx';
import { SellerPayouts } from '../pages/seller/Payouts.jsx';
import { DemoRequests } from '../pages/seller/DemoRequests.jsx';
import { AdminOverview } from '../pages/admin/Overview.jsx';
import { AdminSellers } from '../pages/admin/Sellers.jsx';
import { AdminLiveRooms } from '../pages/admin/LiveRooms.jsx';
import { AdminTransactions } from '../pages/admin/Transactions.jsx';
import { AdminPayouts } from '../pages/admin/Payouts.jsx';
import { AdminSettings } from '../pages/admin/Settings.jsx';
import { AdminUsers } from '../pages/admin/Users.jsx';
import { NotFound } from '../pages/NotFound.jsx';


// The live room pages carry the video SDK, so they load only when opened.
const liveRoom = async () => ({ Component: (await import('../pages/room/LiveRoom.jsx')).LiveRoom });
const liveControl = async () => ({ Component: (await import('../pages/seller/LiveControl.jsx')).LiveControl });
const watchRoom = async () => ({ Component: (await import('../pages/admin/WatchRoom.jsx')).AdminWatchRoom });

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <MallHome /> },
      { path: '/shop/:slug', element: <ShopPage /> },
      { path: '/shop/:slug/live', lazy: liveRoom },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/open-store', element: <OpenStore /> },
      {
        element: <RequireRole />,
        children: [
          { path: '/account', element: <Account /> },
          { path: '/orders', element: <MyOrders /> },
        ],
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
          { path: 'store', element: <StoreProfile /> },
          { path: 'products', element: <SellerProducts /> },
          { path: 'requests', element: <DemoRequests /> },
          { path: 'orders', element: <SellerOrders /> },
          { path: 'payouts', element: <SellerPayouts /> },
          { path: 'live', lazy: liveControl },
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
          { path: 'sellers', element: <AdminSellers /> },
          { path: 'transactions', element: <AdminTransactions /> },
          { path: 'payouts', element: <AdminPayouts /> },
          { path: 'live-rooms', element: <AdminLiveRooms /> },
          { path: 'live-rooms/:sessionId', lazy: watchRoom },
          { path: 'users', element: <AdminUsers /> },
          { path: 'settings', element: <AdminSettings /> },
        ],
      },
    ],
  },
]);
