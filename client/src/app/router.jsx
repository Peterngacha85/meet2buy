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
import { AdminAdmins } from '../pages/admin/Admins.jsx';
import { NotFound } from '../pages/NotFound.jsx';
import { PrivacyPolicy, TermsOfUse } from '../pages/legal/Legal.jsx';
import { ReceiptPage } from '../pages/receipt/Receipt.jsx';
import {
  AdminSupportList,
  BuyerSupportList,
  NewSupportRequest,
  SellerSupportList,
  SupportTicketPage,
} from '../pages/support/SupportPages.jsx';


// The live room pages carry the video SDK, so they load only when opened.
const liveRoom = async () => ({ Component: (await import('../pages/room/LiveRoom.jsx')).LiveRoom });
const liveControl = async () => ({ Component: (await import('../pages/seller/LiveControl.jsx')).LiveControl });
const watchRoom = async () => ({ Component: (await import('../pages/admin/WatchRoom.jsx')).AdminWatchRoom });

export const router = createBrowserRouter([
  // Receipts stand alone (no header/footer) so they print cleanly. Buyer, seller or admin.
  { element: <RequireRole />, children: [{ path: '/receipt/:orderId', element: <ReceiptPage /> }] },
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <MallHome /> },
      { path: '/shop/:slug', element: <ShopPage /> },
      { path: '/shop/:slug/live', lazy: liveRoom },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/open-store', element: <OpenStore /> },
      { path: '/terms', element: <TermsOfUse /> },
      { path: '/privacy', element: <PrivacyPolicy /> },
      {
        element: <RequireRole />,
        children: [
          { path: '/account', element: <Account /> },
          { path: '/orders', element: <MyOrders /> },
          { path: '/orders/:orderId/help', element: <NewSupportRequest /> },
          { path: '/support', element: <BuyerSupportList /> },
          { path: '/support/:id', element: <SupportTicketPage back="/support" /> },
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
          { path: 'support', element: <SellerSupportList /> },
          { path: 'support/:id', element: <SupportTicketPage back="/seller/support" /> },
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
          { path: 'admins', element: <AdminAdmins /> },
          { path: 'support', element: <AdminSupportList /> },
          { path: 'support/:id', element: <SupportTicketPage back="/admin/support" /> },
          { path: 'settings', element: <AdminSettings /> },
        ],
      },
    ],
  },
]);
