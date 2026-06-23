import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { TabBar, SafeArea } from 'antd-mobile'
import { AppOutline, UserOutline, MessageOutline, UnorderedListOutline } from 'antd-mobile-icons'
import Login from './pages/Login'
import Home from './pages/Home'
import StorageModule from './pages/StorageModule'
import CustomModule from './pages/CustomModule'
import Modules from './pages/Modules'
import Items from './pages/Items'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Search from './pages/Search'
import ItemsManagement from './pages/ItemsManagement'
import Categories from './pages/Categories'
import Family from './pages/Family'
import FamilyDetail from './pages/FamilyDetail'
import Stats from './pages/Stats'
import AIAssistant from './pages/AIAssistant'
import Profile from './pages/Profile'
import MemberItems from './pages/MemberItems'
import ActivityLogs from './pages/ActivityLogs'
import Reminders from './pages/Reminders'
import EditProfile from './pages/EditProfile'
import WeeklyStock from './pages/WeeklyStock'
import ReminderSettings from './pages/ReminderSettings'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = [
    { key: '/', title: '首页', icon: <AppOutline /> },
    { key: '/items-mgmt', title: '物品管理', icon: <UnorderedListOutline /> },
    { key: '/ai', title: '储物助手', icon: <MessageOutline /> },
    { key: '/profile', title: '我的', icon: <UserOutline /> },
  ];

  const activeKey = tabs.find(t => t.key === '/' ? location.pathname === '/' : location.pathname.startsWith(t.key))?.key || '/';

  return (
    <>
      <div className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/storage/:type" element={<StorageModule />} />
          <Route path="/boxes/:id" element={<StorageModule />} />
          <Route path="/custom/:id" element={<CustomModule />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/members/:userId/items" element={<MemberItems />} />
          <Route path="/items" element={<Items />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/items/new" element={<ItemForm />} />
          <Route path="/items/:id/edit" element={<ItemForm />} />
          <Route path="/search" element={<Search />} />
          <Route path="/items-mgmt" element={<ItemsManagement />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/family" element={<Family />} />
          <Route path="/family/:id" element={<FamilyDetail />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/weekly-stock" element={<WeeklyStock />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/activity-logs" element={<ActivityLogs />} />
          <Route path="/reminder-settings" element={<ReminderSettings />} />
        </Routes>
      </div>
      <div className="tab-bar-wrapper">
        <TabBar activeKey={activeKey} onChange={key => navigate(key)}>
          {tabs.map(item => (
            <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
          ))}
        </TabBar>
        <SafeArea position="bottom" />
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<PrivateRoute><MainLayout /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
