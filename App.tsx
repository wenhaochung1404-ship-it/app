
import React, { useState, useEffect, useRef } from 'react';
import { Language, UserProfile, HelpRequest, ChatMessage, ChatRoom } from './types';
import { translations } from './translations';

declare const firebase: any;

const App: React.FC = () => {
    const [lang, setLang] = useState<Language>(Language.EN);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [page, setPage] = useState<string>('home');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [isChatHubOpen, setIsChatHubOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [myChatRooms, setMyChatRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemToRedeem, setItemToRedeem] = useState<any>(null);
    
    const sidebarRef = useRef<HTMLElement>(null);
    const langDropdownRef = useRef<HTMLDivElement>(null);

    const t = (key: string) => translations[lang][key] || key;

    const langDisplayNames: Record<Language, string> = {
        [Language.EN]: 'ENGLISH',
        [Language.BM]: 'B. MELAYU',
        [Language.BC]: '中文 (BC)',
        [Language.BI]: 'B.IBAN'
    };

    useEffect(() => {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyDOl93LVxhrfcz04Kj2D2dSQkp22jaeiog",
                authDomain: "miri-care-connect-95a63.firebaseapp.com",
                projectId: "miri-care-connect-95a63",
                storageBucket: "miri-care-connect-95a63.firebasestorage.app",
                messagingSenderId: "419556521920",
                appId: "1:419556521920:web:628bc9d7195fca073a3a25",
                measurementId: "G-7F4LG9P6EC"
            };
            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            const unsubscribeAuth = firebase.auth().onAuthStateChanged(async (authUser: any) => {
                if (authUser) {
                    const db = firebase.firestore();
                    const userDoc = await db.collection('users').doc(authUser.uid).get();
                    if (userDoc.exists) {
                        const data = userDoc.data();
                        setUser(data as UserProfile);
                    } else {
                        const fallbackUser: UserProfile = {
                            uid: authUser.uid,
                            email: authUser.email,
                            displayName: authUser.displayName || authUser.email.split('@')[0],
                            points: 10,
                            settings: { autoShareContact: true, receiveNotifications: true, shareLocation: true, profileVisibility: 'public' }
                        };
                        setUser(fallbackUser);
                    }
                } else { 
                    setUser(null); 
                }
                setLoading(false);
            });

            return () => unsubscribeAuth();
        } catch (err) {
            console.error("Firebase init error:", err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setMyChatRooms([]);
            setUnreadChatCount(0);
            return;
        }
        const db = firebase.firestore();
        const unsubscribe = db.collection('chats')
            .where('participants', 'array-contains', user.uid)
            .orderBy('updatedAt', 'desc')
            .onSnapshot((snap: any) => {
                const rooms = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                setMyChatRooms(rooms);
                const count = rooms.filter((r: any) => r.lastSenderId && r.lastSenderId !== user.uid).length;
                setUnreadChatCount(count);
            });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
            if (e.key.toLowerCase() === 'p' && (user?.isAdmin || user?.email === 'admin@gmail.com')) {
                e.preventDefault();
                setIsAdminPanelOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isLangOpen && langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isLangOpen]);

    const handleLogout = async () => {
        await firebase.auth().signOut();
        setUser(null);
        setPage('home');
        setIsMenuOpen(false);
        setIsAdminPanelOpen(false);
    };

    const openChat = async (req: HelpRequest) => {
        const db = firebase.firestore();
        const chatId = req.id!;
        const chatRef = db.collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();
        
        const chatData: ChatRoom = {
            id: chatId, 
            requestId: req.id!, 
            requestCategory: req.category,
            requestName: req.name,
            participants: [req.userId, req.fulfilledBy!],
            participantNames: [req.userName, req.fulfilledByName!],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (!chatDoc.exists) await chatRef.set(chatData);
        setActiveChat(chatData);
        setIsChatHubOpen(false);
    };

    if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#f8f9fa] text-[#3498db] font-black italic uppercase"><i className="fas fa-spinner fa-spin text-5xl mr-4"></i>Loading</div>;

    return (
        <div className="min-h-screen flex flex-col bg-[#f8f9fa] font-sans selection:bg-blue-100 selection:text-blue-900">
            <header className="bg-[#2c3e50] text-white shadow-xl sticky top-0 z-[100] h-14 sm:h-20 flex items-center">
                <div className="container mx-auto px-4 flex items-center justify-between">
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(true); }} className="p-2 sm:p-3 hover:bg-white/10 rounded-xl transition-all flex items-center gap-2 sm:gap-3">
                        <i className="fas fa-bars text-lg sm:text-xl"></i>
                        <span className="hidden lg:inline font-bold uppercase tracking-widest text-xs">{t('menu')}</span>
                    </button>
                    
                    <div className="flex-1 text-center font-black tracking-tight sm:tracking-widest cursor-pointer text-sm sm:text-xl px-2" onClick={() => setPage('home')}>
                        MIRI <span className="text-[#3498db]">CARE</span> CONNECT
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-6">
                        {(user || window.innerWidth > 640) && (
                            <div className={`${!user ? 'hidden sm:flex' : 'flex'} bg-[#f39c12] px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black items-center gap-1.5 sm:gap-2 shadow-lg cursor-pointer transition-all hover:scale-105`} onClick={() => setPage('profile')}>
                                <i className="fas fa-coins"></i><span>{user?.points || 0} PTS</span>
                            </div>
                        )}
                        {user ? (
                            <button onClick={handleLogout} className="hidden sm:block bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-5 py-2 rounded-full text-xs font-bold transition-all border border-red-500/20">{t('logout')}</button>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="bg-[#3498db] hover:bg-blue-600 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-tight shadow-lg transition-all">{t('login_register')}</button>
                        )}
                    </div>
                </div>
            </header>

            {(user?.isAdmin || user?.email === 'admin@gmail.com') && (
                <button onClick={() => setIsAdminPanelOpen(true)} className="fixed right-0 top-1/2 -translate-y-1/2 z-[90] bg-[#2c3e50] text-white p-3 rounded-l-xl shadow-2xl hover:bg-[#3498db] transition-all flex flex-col items-center gap-1 border-y border-l border-white/10">
                    <i className="fas fa-user-shield text-lg"></i>
                    <span className="[writing-mode:vertical-lr] font-black text-[8px] uppercase tracking-widest py-1">ADMIN</span>
                </button>
            )}

            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] transition-opacity duration-500 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
                onClick={() => setIsMenuOpen(false)} 
            />

            <aside 
                ref={sidebarRef} 
                className={`fixed top-0 left-0 h-full w-[80vw] sm:w-[33.333333vw] bg-white z-[201] transform transition-transform duration-500 ease-in-out shadow-[20px_0_60px_rgba(0,0,0,0.3)] flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 sm:p-12 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-8 sm:mb-12">
                        <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter text-[#2c3e50] uppercase">Miri Connect</h2>
                        <button onClick={() => setIsMenuOpen(false)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-red-500 transition-colors">
                            <i className="fas fa-times text-lg"></i>
                        </button>
                    </div>
                    <nav className="flex flex-col gap-1.5 sm:gap-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <MenuItem icon="home" label={t('home')} onClick={() => { setPage('home'); setIsMenuOpen(false); }} active={page === 'home'} />
                        <MenuItem icon="user" label={t('profile')} onClick={() => { setPage('profile'); setIsMenuOpen(false); }} active={page === 'profile'} />
                        <MenuItem icon="hands-helping" label={t('request_help')} onClick={() => { setPage('request-help'); setIsMenuOpen(false); }} active={page === 'request-help'} />
                        <MenuItem icon="handshake" label={t('offer_help')} onClick={() => { setPage('browse-requests'); setIsMenuOpen(false); }} active={page === 'browse-requests'} />
                        <MenuItem icon="shopping-cart" label={t('points_shop')} onClick={() => { setPage('shop'); setIsMenuOpen(false); }} active={page === 'shop'} />
                        <MenuItem icon="history" label={t('history')} onClick={() => { setPage('history'); setIsMenuOpen(false); }} active={page === 'history'} />
                    </nav>
                </div>
            </aside>

            <main className="flex-1 container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
                {page === 'home' && <HomePage onNavigate={setPage} t={t} user={user} />}
                {page === 'profile' && <ProfilePage user={user} setUser={setUser} t={t} onAuth={() => setIsAuthModalOpen(true)} onNavigate={setPage} onChat={openChat} />}
                {page === 'request-help' && <RequestHelpPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onNavigate={setPage} />}
                {page === 'browse-requests' && <BrowseRequestsPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onChat={openChat} />}
                {page === 'shop' && <ShopPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onRedeemConfirm={setItemToRedeem} />}
                {page === 'history' && <HistoryPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onChat={openChat} />}
            </main>

            <div className="fixed bottom-4 sm:bottom-8 right-4 sm:right-8 z-[150] flex flex-col items-end gap-3 sm:gap-5" ref={langDropdownRef}>
                {isLangOpen && (
                    <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl p-3 sm:p-4 flex flex-col gap-2 border border-gray-100 min-w-[180px] sm:min-w-[200px] animate-in slide-in-from-bottom-4 ring-8 ring-black/5">
                        {Object.values(Language).map(l => (
                            <button key={l} onClick={() => { setLang(l); setIsLangOpen(false); }} className={`px-4 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black tracking-widest text-left flex items-center justify-between transition-all ${lang === l ? 'bg-[#3498db] text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
                                <span>{langDisplayNames[l]}</span>
                                {lang === l && <i className="fas fa-check-circle"></i>}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex gap-2 sm:gap-4">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsChatHubOpen(!isChatHubOpen); setIsSupportOpen(false); }} 
                        className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-2 sm:border-4 border-white relative ${isChatHubOpen ? 'bg-[#27ae60]' : 'bg-white text-[#27ae60]'}`}
                    >
                        <i className={`fas fa-${isChatHubOpen ? 'times' : 'comments'} text-xl sm:text-2xl`}></i>
                        {unreadChatCount > 0 && !isChatHubOpen && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white animate-bounce">
                                {unreadChatCount}
                            </span>
                        )}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsSupportOpen(!isSupportOpen); setIsChatHubOpen(false); }} className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-2 sm:border-4 border-white ${isSupportOpen ? 'bg-[#e74c3c]' : 'bg-[#3498db]'} text-white`}>
                        <i className={`fas fa-${isSupportOpen ? 'times' : 'comment-dots'} text-xl sm:text-2xl`}></i>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsLangOpen(!isLangOpen); }} className="w-12 h-12 sm:w-16 sm:h-16 bg-[#2c3e50] text-white rounded-full shadow-2xl flex items-center justify-center border-2 sm:border-4 border-white active:scale-95 transition-all">
                        <i className="fas fa-language text-2xl sm:text-3xl"></i>
                    </button>
                </div>
            </div>

            {isAdminPanelOpen && <AdminPanel onClose={() => setIsAdminPanelOpen(false)} t={t} user={user!} />}
            {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} t={t} />}
            {activeChat && <ChatWindow chat={activeChat} user={user!} onClose={() => setActiveChat(null)} t={t} />}
            {isSupportOpen && <SupportWindow user={user} onClose={() => setIsSupportOpen(false)} onAuth={() => setIsAuthModalOpen(true)} t={t} />}
            {isChatHubOpen && <ChatHubWindow user={user} rooms={myChatRooms} onClose={() => setIsChatHubOpen(false)} onSelectChat={(room) => { setActiveChat(room); setIsChatHubOpen(false); }} onAuth={() => setIsAuthModalOpen(true)} t={t} />}
            
            {itemToRedeem && (
                <RedeemConfirmModal 
                    item={itemToRedeem} 
                    user={user!} 
                    onCancel={() => setItemToRedeem(null)} 
                    onConfirm={async (fullName, userClass) => {
                        const db = firebase.firestore();
                        try {
                            const userRef = db.collection('users').doc(user!.uid);
                            await db.runTransaction(async (transaction: any) => {
                                const userDoc = await transaction.get(userRef);
                                if (userDoc.data().points < itemToRedeem.cost) throw "Not enough points";
                                transaction.update(userRef, { points: userDoc.data().points - itemToRedeem.cost });
                                transaction.set(db.collection('redeem_history').doc(), {
                                    userId: user!.uid, fullName, userClass, itemName: itemToRedeem.name, 
                                    itemPoints: itemToRedeem.cost, redeemedAt: firebase.firestore.FieldValue.serverTimestamp()
                                });
                            });
                            setUser({...user!, points: user!.points - itemToRedeem.cost});
                            setItemToRedeem(null);
                            alert("Voucher redeemed! Check your collection point.");
                        } catch (e) { alert("Redemption failed: " + e); }
                    }} 
                    t={t} 
                />
            )}
        </div>
    );
};

const MenuItem: React.FC<{icon: string, label: string, onClick: () => void, active?: boolean}> = ({icon, label, onClick, active}) => (
    <button onClick={onClick} className={`flex items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-xl sm:rounded-2xl transition-all ${active ? 'bg-[#3498db] text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50 hover:text-[#2c3e50]'}`}>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl ${active ? 'bg-white/20' : 'bg-gray-100'}`}>
            <i className={`fas fa-${icon} text-xs sm:text-sm`}></i>
        </div>
        <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest">{label}</span>
    </button>
);

const HomePage: React.FC<{onNavigate: (p: string) => void, t: any, user: UserProfile | null}> = ({onNavigate, t, user}) => (
    <div className="space-y-6 sm:space-y-12">
        <section className="bg-[#2c3e50] text-white rounded-2xl sm:rounded-[3rem] p-6 sm:p-24 text-center shadow-2xl overflow-hidden relative border-b-4 sm:border-b-8 border-[#3498db]">
            <h1 className="text-2xl sm:text-7xl font-black mb-3 sm:mb-8 italic uppercase tracking-tighter drop-shadow-lg leading-tight">{t('hero_title')}</h1>
            <p className="text-xs sm:text-xl mb-6 sm:mb-12 opacity-80 max-w-2xl mx-auto leading-relaxed">{t('hero_description')}</p>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:gap-4 justify-center relative z-20">
                <button onClick={() => onNavigate('request-help')} className="bg-[#e74c3c] py-3 sm:px-12 sm:py-5 rounded-xl sm:rounded-full font-black text-xs sm:text-lg shadow-xl hover:bg-red-600 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
                    <i className="fas fa-hand-holding-heart mb-1 sm:hidden block text-xl"></i>
                    {t('request_help')}
                </button>
                <button onClick={() => onNavigate('browse-requests')} className="bg-[#3498db] py-3 sm:px-12 sm:py-5 rounded-xl sm:rounded-full font-black text-xs sm:text-lg shadow-xl hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
                    <i className="fas fa-search mb-1 sm:hidden block text-xl"></i>
                    {t('offer_help')}
                </button>
            </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-6 sm:p-10 rounded-2xl sm:rounded-[2rem] shadow-lg text-center border border-gray-100 hover:border-[#3498db] transition-all group flex sm:flex-col items-center sm:items-center text-left sm:text-center gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 text-[#3498db] group-hover:bg-[#3498db] group-hover:text-white rounded-xl sm:rounded-2xl flex-shrink-0 flex items-center justify-center text-xl sm:text-2xl font-black transition-all">0{i}</div>
                    <div>
                        <h3 className="text-sm sm:text-xl font-black mb-1 sm:mb-4 uppercase text-[#2c3e50] tracking-tight">{t(`step${i}_title`)}</h3>
                        <p className="text-gray-400 text-[10px] sm:text-sm leading-relaxed">{t(`step${i}_desc`)}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const ProfilePage: React.FC<{user: UserProfile | null, setUser: any, t: any, onAuth: () => void, onNavigate: any, onChat: any}> = ({user, setUser, t, onAuth, onNavigate, onChat}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ displayName: '', age: 0, phone: '', address: '' });
    const [historyTab, setHistoryTab] = useState<'requests' | 'fulfillments' | 'redemptions'>('requests');
    const [requests, setRequests] = useState<any[]>([]);
    const [helped, setHelped] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            setEditData({ 
                displayName: user.displayName || '', 
                age: user.age || 0, 
                phone: user.phone || '', 
                address: user.address || '' 
            });
            
            const db = firebase.firestore();
            // Fetch requests
            db.collection('history').where('userId', '==', user.uid).orderBy('createdAt', 'desc').get().then((snap: any) => {
                setRequests(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
            });
            // Fetch fulfillments
            db.collection('history').where('fulfilledBy', '==', user.uid).orderBy('createdAt', 'desc').get().then((snap: any) => {
                setHelped(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
            });
            // Fetch redemptions
            db.collection('redeem_history').where('userId', '==', user.uid).orderBy('redeemedAt', 'desc').get().then((snap: any) => {
                setRedemptions(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
            });
        }
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        const db = firebase.firestore();
        try {
            await db.collection('users').doc(user.uid).update(editData);
            setUser({ ...user, ...editData });
            setIsEditing(false);
            alert(t('update_success'));
        } catch (e) { alert("Update failed: " + e); }
    };

    if (!user) return (
        <div className="text-center py-16 sm:py-24 bg-white rounded-2xl sm:rounded-[3rem] shadow-xl max-w-xl mx-auto px-6 sm:px-8 border border-gray-100">
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 text-3xl sm:text-5xl">
                <i className="fas fa-user-lock"></i>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-4 uppercase tracking-tighter">{t('profile')}</h2>
            <button onClick={onAuth} className="bg-[#3498db] text-white px-10 py-3 sm:px-12 sm:py-5 rounded-full font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Sign In</button>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-10 pb-20">
            {/* Header Section */}
            <div className="bg-[#2c3e50] p-8 sm:p-12 rounded-2xl sm:rounded-[3rem] shadow-xl text-white relative overflow-hidden border-b-8 border-[#f39c12]">
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-[#3498db] rounded-full flex items-center justify-center text-4xl sm:text-6xl font-black shadow-2xl ring-8 ring-white/10 uppercase">
                        {user.displayName[0]}
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-end gap-3 mb-2">
                            <h1 className="text-3xl sm:text-5xl font-black uppercase italic tracking-tighter leading-none">{user.displayName}</h1>
                            <span className="text-[#3498db] font-black uppercase text-xs tracking-widest mb-1">Miri Citizen</span>
                        </div>
                        <p className="text-white/60 font-bold text-sm sm:text-lg mb-6">{user.email}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                                <div className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">{t('points')}</div>
                                <div className="text-2xl font-black text-[#f39c12]">{user.points} <span className="text-xs">PTS</span></div>
                            </div>
                            <button onClick={() => onNavigate('shop')} className="bg-[#f39c12] hover:bg-orange-500 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95">
                                <i className="fas fa-shopping-basket"></i> {t('points_shop')}
                            </button>
                        </div>
                    </div>
                    <button onClick={() => setIsEditing(!isEditing)} className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 ${isEditing ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                        <i className={`fas fa-${isEditing ? 'times' : 'user-edit'}`}></i> {isEditing ? t('cancel') : t('edit_profile')}
                    </button>
                </div>
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
                {/* Personal Info Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 sm:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-gray-100">
                        <h2 className="text-xl font-black uppercase mb-8 text-[#2c3e50] flex items-center gap-3">
                            <i className="fas fa-id-card text-[#3498db]"></i> {t('personal_info')}
                        </h2>
                        <div className="space-y-6">
                            {[
                                { key: 'displayName', label: t('full_name'), icon: 'user' },
                                { key: 'age', label: t('age'), icon: 'calendar-alt', type: 'number' },
                                { key: 'phone', label: t('phone_number'), icon: 'phone' },
                                { key: 'address', label: t('home_address'), icon: 'map-marker-alt' }
                            ].map(field => (
                                <div key={field.key} className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <i className={`fas fa-${field.icon} text-[8px]`}></i> {field.label}
                                    </label>
                                    <input 
                                        disabled={!isEditing}
                                        type={field.type || 'text'}
                                        value={(editData as any)[field.key]}
                                        onChange={e => setEditData({...editData, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value})}
                                        className={`w-full p-4 rounded-xl border-2 font-bold outline-none transition-all text-sm ${isEditing ? 'border-[#3498db] bg-white text-[#2c3e50] shadow-inner' : 'border-gray-50 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                                    />
                                </div>
                            ))}
                            {isEditing && (
                                <button onClick={handleSave} className="w-full bg-[#2c3e50] text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-[#3498db] transition-all">
                                    {t('save_changes')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* History Column */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full min-h-[600px]">
                        <div className="p-8 pb-0 border-b border-gray-100">
                            <h2 className="text-xl font-black uppercase mb-6 text-[#2c3e50] flex items-center gap-3">
                                <i className="fas fa-history text-[#3498db]"></i> {t('activity_summary')}
                            </h2>
                            <div className="flex gap-4 overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'requests', label: t('my_requests'), icon: 'hand-holding-heart' },
                                    { id: 'fulfillments', label: t('helped_others'), icon: 'handshake' },
                                    { id: 'redemptions', label: t('redemptions'), icon: 'gift' }
                                ].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={() => setHistoryTab(tab.id as any)}
                                        className={`px-6 py-3 rounded-t-2xl font-black uppercase tracking-widest text-[10px] whitespace-nowrap transition-all flex items-center gap-2 ${historyTab === tab.id ? 'bg-[#2c3e50] text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        <i className={`fas fa-${tab.icon}`}></i> {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 bg-gray-50/50 p-6 sm:p-8 overflow-y-auto no-scrollbar">
                            {/* Requests Tab */}
                            {historyTab === 'requests' && (
                                <div className="space-y-4">
                                    {requests.length === 0 ? <EmptyState icon="folder-open" msg="No requests posted yet." /> : 
                                    requests.map(req => (
                                        <HistoryCard key={req.id} title={req.name} status={req.status} date={req.createdAt} points={5} icon="heart" t={t} onChat={() => onChat(req)} />
                                    ))}
                                </div>
                            )}

                            {/* Fulfillments Tab */}
                            {historyTab === 'fulfillments' && (
                                <div className="space-y-4">
                                    {helped.length === 0 ? <EmptyState icon="hands-helping" msg="You haven't helped anyone yet. Start today!" /> : 
                                    helped.map(h => (
                                        <HistoryCard key={h.id} title={h.name} status={h.status} date={h.createdAt} points={5} icon="check-circle" t={t} onChat={() => onChat(h)} isKindness />
                                    ))}
                                </div>
                            )}

                            {/* Redemptions Tab */}
                            {historyTab === 'redemptions' && (
                                <div className="space-y-4">
                                    {redemptions.length === 0 ? <EmptyState icon="gift" msg="No redemptions found. Save points for rewards!" /> : 
                                    redemptions.map(r => (
                                        <div key={r.id} className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-orange-50 text-[#f39c12] rounded-xl flex items-center justify-center text-xl shadow-inner">
                                                    <i className="fas fa-ticket-alt"></i>
                                                </div>
                                                <div>
                                                    <div className="font-black uppercase italic text-[#2c3e50] text-sm">{r.itemName}</div>
                                                    <div className="text-[10px] font-bold text-gray-300 uppercase">{r.redeemedAt?.toDate().toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[#f39c12] font-black">-{r.itemPoints} <span className="text-[8px] uppercase">PTS</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmptyState: React.FC<{icon: string, msg: string}> = ({icon, msg}) => (
    <div className="h-full flex flex-col items-center justify-center py-20 text-gray-200 opacity-50">
        <i className={`fas fa-${icon} text-6xl mb-6`}></i>
        <p className="font-black uppercase tracking-widest text-[10px]">{msg}</p>
    </div>
);

const HistoryCard: React.FC<{title: string, status: string, date: any, points: number, icon: string, t: any, onChat: () => void, isKindness?: boolean}> = ({title, status, date, points, icon, t, onChat, isKindness}) => (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm group hover:border-[#3498db] transition-all">
        <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner ${isKindness ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-[#3498db]'}`}>
                <i className={`fas fa-${icon}`}></i>
            </div>
            <div>
                <div className="font-black uppercase italic text-[#2c3e50] text-sm truncate max-w-[150px] sm:max-w-[250px]">{title}</div>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${status === 'pending' ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-500'}`}>
                        {t(`status_${status}`)}
                    </span>
                    <span className="text-[8px] font-bold text-gray-200 uppercase">{date?.toDate().toLocaleDateString()}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
                <div className={`${isKindness ? 'text-green-500' : 'text-gray-300'} font-black text-sm`}>{isKindness ? '+' : ''}{points} <span className="text-[8px] uppercase">PTS</span></div>
            </div>
            {status !== 'pending' && (
                <button onClick={onChat} className="w-10 h-10 bg-gray-50 text-gray-400 hover:bg-[#3498db] hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <i className="fas fa-comment"></i>
                </button>
            )}
        </div>
    </div>
);

const AdminPanel: React.FC<{ onClose: () => void, t: any, user: UserProfile }> = ({ onClose, t, user }) => {
    const [tab, setTab] = useState<'users' | 'support'>('users');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [supportChats, setSupportChats] = useState<any[]>([]);
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const db = firebase.firestore();
        const unsubsUsers = db.collection('users').onSnapshot((snap: any) => {
            setUsers(snap.docs.map((d: any) => d.data() as UserProfile));
            setLoading(false);
        });
        const unsubsSupport = db.collection('support_chats').orderBy('updatedAt', 'desc').onSnapshot((snap: any) => {
            setSupportChats(snap.docs.map((d: any) => d.data()));
        });
        return () => { unsubsUsers(); unsubsSupport(); };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2rem] sm:rounded-[3rem] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="font-black text-2xl sm:text-4xl tracking-tighter italic uppercase text-[#2c3e50]">{t('admin_panel')}</h2>
                        <div className="flex gap-4 mt-4">
                            <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${tab === 'users' ? 'bg-[#3498db] text-white' : 'bg-white border border-gray-200 text-gray-400'}`}>{t('user_management')}</button>
                            <button onClick={() => setTab('support')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${tab === 'support' ? 'bg-[#3498db] text-white' : 'bg-white border border-gray-200 text-gray-400'}`}>{t('support_inbox')}</button>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-white shadow-xl rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-all font-black text-2xl">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-gray-50/20">
                    {loading ? <div className="text-center py-20"><i className="fas fa-spinner fa-spin text-3xl text-[#3498db]"></i></div> : 
                    tab === 'users' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {users.map(u => (
                                <div key={u.uid} className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#3498db] text-white rounded-full flex items-center justify-center text-xl font-black">{u.displayName[0]?.toUpperCase()}</div>
                                        <div>
                                            <div className="font-black text-lg text-[#2c3e50] uppercase italic">{u.displayName}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">{u.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase text-gray-300 tracking-widest mb-1">{t('points')}</div>
                                        <div className="font-black text-2xl text-[#f39c12]">{u.points}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full">
                            <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2">
                                {supportChats.length === 0 ? <p className="text-center py-10 opacity-30 italic">No support messages</p> : 
                                supportChats.map(c => (
                                    <div key={c.userId} onClick={() => setSelectedChat(c)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedChat?.userId === c.userId ? 'bg-[#3498db] text-white' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                                        <div className="font-black uppercase italic truncate">{c.userName}</div>
                                        <div className="text-[10px] font-bold opacity-60 truncate">{c.lastMessage}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="md:col-span-2 h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
                                {selectedChat ? <AdminSupportChat chat={selectedChat} admin={user} /> : <div className="flex-1 flex items-center justify-center text-gray-200 italic">Select a user to support</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdminSupportChat: React.FC<{chat: any, admin: UserProfile}> = ({chat, admin}) => {
    const [msgs, setMsgs] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const db = firebase.firestore();
        const supportRef = db.collection('support_chats').doc(chat.userId);
        return supportRef.collection('messages').orderBy('timestamp').onSnapshot((snap: any) => {
            setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        });
    }, [chat.userId]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        const db = firebase.firestore();
        const supportRef = db.collection('support_chats').doc(chat.userId);
        const msg = { senderId: admin.uid, senderName: "Administrator", text: input, timestamp: firebase.firestore.FieldValue.serverTimestamp(), isAdmin: true };
        await supportRef.update({ lastMessage: input, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await supportRef.collection('messages').add(msg);
        setInput('');
    };

    return (
        <>
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h4 className="font-black uppercase italic text-[#2c3e50]">{chat.userName}</h4>
                <p className="text-[10px] text-gray-300 font-bold uppercase">{chat.userEmail}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {msgs.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.isAdmin ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] font-bold text-sm ${m.isAdmin ? 'bg-[#3498db] text-white rounded-tr-none' : 'bg-gray-100 text-gray-700 rounded-tl-none'}`}>{m.text}</div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-3">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type admin reply..." className="flex-1 bg-gray-50 border border-gray-100 p-3 rounded-full outline-none font-bold text-sm" />
                <button type="submit" className="bg-[#3498db] text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg"><i className="fas fa-paper-plane"></i></button>
            </form>
        </>
    );
};

const BrowseRequestsPage: React.FC<{user: UserProfile | null, t: any, onAuth: () => void, onChat: (req: HelpRequest) => void}> = ({user, t, onAuth, onChat}) => {
    const [requests, setRequests] = useState<HelpRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const db = firebase.firestore();
        const unsubscribe = db.collection('requests')
            .where('status', '==', 'pending')
            .onSnapshot((snap: any) => {
                const fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                // Sort by urgency: High > Medium > Low
                const urgencyScore: Record<string, number> = {
                    'high': 3,
                    'medium': 2,
                    'low': 1
                };
                fetched.sort((a: HelpRequest, b: HelpRequest) => {
                    return urgencyScore[b.urgency] - urgencyScore[a.urgency];
                });
                setRequests(fetched);
                setLoading(false);
            });
        return () => unsubscribe();
    }, []);

    const handleOfferHelp = async (req: HelpRequest) => {
        if (!user) return onAuth();
        if (user.uid === req.userId) return alert("You can't fulfill your own request.");
        
        const db = firebase.firestore();
        try {
            const batch = db.batch();
            const reqRef = db.collection('requests').doc(req.id);
            const histRef = db.collection('history').doc(req.id);
            
            const updates = {
                status: 'fulfilled',
                fulfilledBy: user.uid,
                fulfilledByName: user.displayName,
                fulfilledAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            batch.update(reqRef, updates);
            batch.update(histRef, updates);
            
            const chatRef = db.collection('chats').doc(req.id);
            batch.set(chatRef, {
                id: req.id,
                requestId: req.id,
                requestName: req.name,
                requestCategory: req.category,
                participants: [req.userId, user.uid],
                participantNames: [req.userName, user.displayName],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: "Conversation started"
            });

            await batch.commit();
            alert("Success! Connect via chat to arrange handover.");
        } catch (e) { alert("Error: " + e); }
    };

    if (loading) return <div className="text-center py-16 sm:py-20"><i className="fas fa-circle-notch fa-spin text-3xl sm:text-4xl text-[#3498db]"></i></div>;

    return (
        <div className="space-y-8 sm:space-y-12">
            <h1 className="text-2xl sm:text-5xl font-black italic tracking-tighter uppercase text-[#2c3e50] border-l-4 sm:border-l-8 border-[#3498db] pl-4 sm:pl-8">
                {t('offer_help')}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {requests.length === 0 ? (
                    <div className="col-span-full py-16 sm:py-20 text-center bg-white rounded-xl sm:rounded-[2rem] border-2 border-dashed border-gray-100">
                        <p className="text-gray-300 font-black uppercase tracking-widest italic text-xs sm:text-sm">No active requests in your area</p>
                    </div>
                ) : requests.map(req => (
                    <div key={req.id} className="bg-white p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col group hover:border-[#3498db] transition-all relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6 sm:mb-8">
                            <span className="bg-blue-50 text-[#3498db] px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest">{t(`category_${req.category}`)}</span>
                            <span className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                req.urgency === 'high' ? 'bg-red-500 text-white animate-pulse' : 
                                req.urgency === 'medium' ? 'bg-orange-100 text-orange-600' : 
                                'bg-gray-100 text-gray-400'
                            }`}>
                                {t(`urgency_${req.urgency}`)}
                            </span>
                        </div>
                        <h3 className="text-lg sm:text-2xl font-black mb-2 sm:mb-3 uppercase italic truncate text-[#2c3e50]">{req.name}</h3>
                        <p className="text-xs sm:text-base text-gray-400 font-medium mb-8 sm:mb-10 flex-1 leading-relaxed italic">"{req.description}"</p>
                        <div className="pt-6 sm:pt-8 border-t border-gray-50 flex items-center justify-between">
                             <div className="text-[8px] sm:text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                <i className="fas fa-map-marker-alt mr-1 sm:mr-2"></i> Miri
                             </div>
                             <button onClick={() => handleOfferHelp(req)} className="bg-[#2c3e50] text-white px-5 sm:px-8 py-2.5 sm:py-4 rounded-full font-black uppercase tracking-widest text-[8px] sm:text-[10px] shadow-lg hover:bg-[#3498db] transition-all">Support Now</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HistoryPage: React.FC<{user: UserProfile | null, t: any, onAuth: any, onChat: (req: HelpRequest) => void}> = ({user, t, onAuth, onChat}) => {
    const [tab, setTab] = useState<'mine' | 'helped'>('mine');
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        const db = firebase.firestore();
        const query = tab === 'mine' ? 
            db.collection('history').where('userId', '==', user.uid) : 
            db.collection('history').where('fulfilledBy', '==', user.uid);

        return query.onSnapshot((snap: any) => {
            setData(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        });
    }, [user, tab]);

    if (!user) return <div className="text-center py-16 sm:py-20"><button onClick={onAuth} className="bg-[#3498db] text-white px-10 py-4 rounded-full font-black uppercase tracking-widest shadow-lg">Sign In to View History</button></div>;

    return (
        <div className="space-y-8 sm:space-y-12">
            <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter uppercase text-[#2c3e50]">{t('history')}</h1>
            <div className="flex bg-white p-1.5 sm:p-2 rounded-full shadow-lg max-w-md mx-auto border border-gray-50">
                <button onClick={() => setTab('mine')} className={`flex-1 py-3 sm:py-4 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all ${tab === 'mine' ? 'bg-[#2c3e50] text-white shadow-md' : 'text-gray-400'}`}>{t('my_requests')}</button>
                <button onClick={() => setTab('helped')} className={`flex-1 py-3 sm:py-4 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all ${tab === 'helped' ? 'bg-[#2c3e50] text-white shadow-md' : 'text-gray-400'}`}>{t('helped_others')}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {data.length === 0 ? (
                    <div className="col-span-full py-16 sm:py-20 text-center opacity-30 italic font-bold">No records found.</div>
                ) : data.map(item => (
                    <div key={item.id} className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-gray-100 shadow-xl flex items-center justify-between group hover:border-[#3498db] transition-all">
                        <div>
                            <h3 className="font-black text-base sm:text-xl uppercase italic text-[#2c3e50] mb-1">{item.name}</h3>
                            <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1 rounded-full ${item.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'}`}>{item.status}</span>
                        </div>
                        {item.status !== 'pending' && (
                            <button onClick={() => onChat(item)} className="bg-white border-2 border-blue-100 text-[#3498db] px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-[8px] sm:text-[10px] uppercase transition-all hover:bg-[#3498db] hover:text-white hover:border-[#3498db] shadow-sm flex items-center gap-1.5 sm:gap-2">
                                <i className="fas fa-comments text-sm sm:text-base"></i> {t('chat')}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ShopPage: React.FC<{user: UserProfile | null, t: any, onAuth: any, onRedeemConfirm: (item: any) => void}> = ({user, t, onAuth, onRedeemConfirm}) => {
    const shopItems = [
        { id: '1', name: t('voucher_5'), cost: 20, color: '#27ae60' },
        { id: '2', name: t('voucher_10'), cost: 40, color: '#3498db' },
        { id: '3', name: t('voucher_15'), cost: 50, color: '#f39c12' }
    ];
    return (
        <div className="space-y-12">
            <h1 className="text-2xl sm:text-6xl font-black italic tracking-tighter uppercase text-[#2c3e50] text-center">{t('points_shop')}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
                {shopItems.map(item => (
                    <div key={item.id} className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-xl text-center group transition-all">
                        <div className="p-8 sm:p-12 sm:pb-6">
                            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 text-2xl sm:text-4xl text-[#f39c12] shadow-inner group-hover:scale-110 transition-transform">
                                <i className="fas fa-gift"></i>
                            </div>
                            <h3 className="font-black text-lg sm:text-2xl mb-1 sm:mb-2 uppercase italic text-[#2c3e50]">{item.name}</h3>
                            <div className="text-2xl sm:text-4xl font-black text-[#f39c12] mb-6 sm:mb-10 flex items-center justify-center gap-2">
                                <span className="text-sm sm:text-xl">PTS</span> {item.cost}
                            </div>
                        </div>
                        <button 
                            onClick={() => { if(!user) return onAuth(); onRedeemConfirm(item); }} 
                            className="w-full text-white py-4 sm:py-6 font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all hover:opacity-90"
                            style={{backgroundColor: item.color}}
                        >
                            Redeem Reward
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RequestHelpPage: React.FC<{user: UserProfile | null, t: any, onAuth: () => void, onNavigate: any}> = ({user, t, onAuth, onNavigate}) => {
    const [form, setForm] = useState({ 
        name: user?.displayName || '', 
        age: user?.age || '', 
        address: user?.address || '', 
        phone: user?.phone || '', 
        category: '', 
        description: '',
        urgency: 'medium' as 'low' | 'medium' | 'high'
    });

    const handlePostRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const db = firebase.firestore();
        const requestData = { 
            ...form, 
            userId: user.uid, userName: user.displayName, userEmail: user.email,
            status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(), points: 5 
        };
        try {
            const docRef = await db.collection('requests').add(requestData);
            await db.collection('history').doc(docRef.id).set({ ...requestData, id: docRef.id });
            alert("Success! Neighbors in Miri can now see your request.");
            onNavigate('browse-requests');
        } catch (err) { alert("Error: " + err); }
    };

    if (!user) return <div className="text-center py-16 sm:py-24 bg-white rounded-2xl sm:rounded-[3rem] shadow-xl max-w-xl mx-auto border border-gray-100"><button onClick={onAuth} className="bg-[#3498db] text-white px-10 py-3 sm:px-16 sm:py-5 rounded-full font-black uppercase tracking-widest shadow-xl">Sign In to Request</button></div>;

    return (
        <div className="max-w-3xl mx-auto bg-white p-6 sm:p-20 rounded-2xl sm:rounded-[4rem] shadow-2xl border border-gray-100 relative overflow-hidden">
            <h1 className="text-2xl sm:text-5xl font-black text-center mb-10 sm:mb-16 italic uppercase text-[#2c3e50] tracking-tighter underline decoration-[#3498db] decoration-4 sm:decoration-8 underline-offset-8 decoration-skip-ink">{t('request_help')}</h1>
            <form onSubmit={handlePostRequest} className="space-y-6 sm:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-2">
                        <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-300 ml-4 tracking-[0.2em]">Urgency Level</label>
                        <select 
                            value={form.urgency} 
                            onChange={e => setForm({...form, urgency: e.target.value as any})} 
                            className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold focus:border-[#3498db] transition-all shadow-inner appearance-none text-sm"
                            required
                        >
                            <option value="high">High (Urgent)</option>
                            <option value="medium">Medium (Regular)</option>
                            <option value="low">Low (Flexible)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-300 ml-4 tracking-[0.2em]">Category</label>
                        <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold focus:border-[#3498db] transition-all shadow-inner appearance-none text-sm" required>
                            <option value="">Choose Category</option>
                            <option value="food">{t('category_food')}</option>
                            <option value="clothing">{t('category_clothing')}</option>
                            <option value="books">{t('category_books')}</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-300 ml-4 tracking-[0.2em]">Describe Your Need</label>
                    <textarea rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold focus:border-[#3498db] transition-all shadow-inner resize-none text-sm" placeholder="What items do you need? (e.g. 2kg Rice, Baby Diapers...)" required />
                </div>
                <button type="submit" className="w-full bg-[#2c3e50] text-white py-5 sm:py-8 rounded-full font-black text-lg sm:text-2xl shadow-2xl hover:bg-[#3498db] active:scale-95 transition-all uppercase tracking-tighter">{t('submit_request')}</button>
            </form>
        </div>
    );
};

const ChatWindow: React.FC<{chat: ChatRoom, user: UserProfile, onClose: () => void, t: any}> = ({chat, user, onClose, t}) => {
    const [msgs, setMsgs] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const db = firebase.firestore();
        return db.collection('chats').doc(chat.id).collection('messages').orderBy('timestamp').onSnapshot((snap: any) => setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    }, [chat.id]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        const db = firebase.firestore();
        const batch = db.batch();
        const msgRef = db.collection('chats').doc(chat.id).collection('messages').doc();
        batch.set(msgRef, { senderId: user.uid, senderName: user.displayName, text: input, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        batch.update(db.collection('chats').doc(chat.id), { 
            lastMessage: input, 
            lastSenderId: user.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        await batch.commit();
        setInput('');
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white w-full max-w-xl h-[85vh] rounded-[2rem] sm:rounded-[3rem] flex flex-col shadow-2xl relative animate-in zoom-in" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-[2rem] sm:rounded-t-[3rem]">
                    <div className="min-w-0 pr-4">
                        <h2 className="font-black text-lg sm:text-2xl uppercase italic text-[#3498db] truncate leading-tight">{chat.requestName}</h2>
                        <p className="text-[8px] sm:text-[10px] font-black uppercase text-gray-300 tracking-[0.2em] mt-0.5 sm:mt-1">Peer Connection</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 bg-white shadow-xl rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-all font-black text-xl sm:text-2xl flex-shrink-0">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-4 sm:space-y-6 bg-white no-scrollbar">
                    {msgs.map(m => (
                        <div key={m.id} className={`flex flex-col ${m.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                            <span className="text-[8px] sm:text-[9px] font-black text-gray-200 mb-1 uppercase tracking-widest">{m.senderName}</span>
                            <div className={`px-5 sm:px-8 py-3 sm:py-5 rounded-[1.5rem] sm:rounded-[2.2rem] max-w-[85%] font-bold text-xs sm:text-sm leading-relaxed shadow-sm ${m.senderId === user.uid ? 'bg-[#3498db] text-white rounded-tr-none' : 'bg-gray-100 text-[#2c3e50] rounded-tl-none border border-gray-100'}`}>{m.text}</div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
                <form onSubmit={handleSend} className="p-6 sm:p-8 bg-gray-50 border-t border-gray-100 flex gap-3 sm:gap-4 rounded-b-[2rem] sm:rounded-b-[3rem]">
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('type_message')} className="flex-1 bg-white border-2 border-gray-100 p-4 sm:p-6 rounded-full outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" />
                    <button type="submit" className="bg-[#3498db] text-white w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all flex-shrink-0"><i className="fas fa-paper-plane text-base sm:text-xl"></i></button>
                </form>
            </div>
        </div>
    );
};

const ChatHubWindow: React.FC<{user: UserProfile | null, rooms: ChatRoom[], onClose: () => void, onSelectChat: (r: ChatRoom) => void, onAuth: () => void, t: any}> = ({user, rooms, onClose, onSelectChat, onAuth, t}) => {
    if (!user) return (
        <div className="fixed bottom-20 sm:bottom-32 right-4 sm:right-32 z-[150] bg-white w-[300px] sm:w-[350px] rounded-2xl sm:rounded-[3rem] shadow-2xl p-8 sm:p-12 text-center animate-in zoom-in border border-gray-100">
            <i className="fas fa-comments text-4xl sm:text-5xl text-gray-100 mb-6 sm:mb-8"></i>
            <h3 className="font-black uppercase italic text-[#2c3e50] mb-3 sm:mb-4 text-lg">Private Messenger</h3>
            <p className="text-gray-400 text-xs mb-8 leading-relaxed font-medium">Sign in to securely chat with neighbors and arrange handovers.</p>
            <button onClick={onAuth} className="w-full bg-[#27ae60] text-white py-4 rounded-full font-black uppercase tracking-widest text-[10px] shadow-lg">Sign In</button>
        </div>
    );

    return (
        <div className="fixed bottom-20 sm:bottom-32 right-4 sm:right-32 z-[150] bg-white w-[90vw] sm:w-[400px] h-[60vh] sm:h-[600px] rounded-2xl sm:rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.3)] flex flex-col animate-in zoom-in border border-gray-100 overflow-hidden ring-4 sm:ring-12 ring-black/5">
            <div className="p-6 sm:p-8 bg-[#27ae60] text-white flex justify-between items-center rounded-t-2xl sm:rounded-t-[3.5rem] shadow-xl">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-xl flex items-center justify-center shadow-inner"><i className="fas fa-comments text-xl sm:text-2xl"></i></div>
                    <div><h3 className="font-black uppercase italic text-base sm:text-xl leading-none">{t('neighbor_chat')}</h3><p className="text-[8px] sm:text-[10px] uppercase tracking-widest font-bold opacity-60 mt-1 sm:mt-1">Miri Community</p></div>
                </div>
                <button onClick={onClose} className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center hover:bg-black/20 transition-all font-black text-lg">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 no-scrollbar bg-gray-50/50">
                {rooms.length === 0 ? (
                    <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
                        <i className="fas fa-comment-slash text-5xl sm:text-7xl"></i>
                        <p className="font-black uppercase text-[8px] sm:text-[10px] tracking-[0.3em]">No active conversations</p>
                    </div>
                ) : rooms.map(room => (
                    <div 
                        key={room.id} 
                        onClick={() => onSelectChat(room)}
                        className={`p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border bg-white shadow-sm hover:border-[#27ae60] transition-all cursor-pointer relative flex items-center gap-4 sm:gap-5 group ${room.lastSenderId && room.lastSenderId !== user.uid ? 'border-l-4 sm:border-l-8 border-l-[#27ae60]' : 'border-gray-100'}`}
                    >
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gray-50 rounded-xl flex items-center justify-center text-[#27ae60] font-black group-hover:bg-[#27ae60] group-hover:text-white transition-all text-lg">{room.requestName?.[0] || '?'}</div>
                        <div className="flex-1 min-w-0">
                            <div className="font-black uppercase italic tracking-tighter truncate text-[#2c3e50] text-sm sm:text-lg">{room.requestName}</div>
                            <div className="text-[10px] sm:text-[11px] text-gray-400 font-bold truncate mt-0.5 sm:mt-1">
                                {room.lastMessage || "Begin chat..."}
                            </div>
                        </div>
                        {room.lastSenderId && room.lastSenderId !== user.uid && (
                            <div className="w-3 h-3 bg-[#27ae60] rounded-full shadow-lg animate-pulse border-2 border-white"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const SupportWindow: React.FC<{user: UserProfile | null, onClose: () => void, onAuth: () => void, t: any}> = ({user, onClose, onAuth, t}) => {
    if (!user) return (
        <div className="fixed bottom-20 sm:bottom-32 right-4 sm:right-8 z-[150] bg-white w-[300px] sm:w-[350px] rounded-2xl sm:rounded-[3rem] shadow-2xl p-8 sm:p-12 text-center animate-in zoom-in border border-gray-100">
            <i className="fas fa-headset text-4xl sm:text-6xl text-gray-100 mb-6 sm:mb-8"></i>
            <h3 className="font-black uppercase italic text-[#2c3e50] mb-4 text-lg">Miri Support</h3>
            <button onClick={onAuth} className="w-full bg-[#3498db] text-white py-4 rounded-full font-black uppercase text-[10px] shadow-lg">Sign In</button>
        </div>
    );
    return (
        <div className="fixed bottom-20 sm:bottom-32 right-4 sm:right-8 z-[150] bg-white w-[90vw] sm:w-[400px] h-[50vh] sm:h-[600px] rounded-2xl sm:rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.3)] flex flex-col animate-in zoom-in border border-gray-100 overflow-hidden ring-4 sm:ring-12 ring-black/5">
            <div className="p-6 sm:p-8 bg-[#3498db] text-white flex justify-between items-center rounded-t-2xl sm:rounded-t-[3.5rem] shadow-xl">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-xl flex items-center justify-center"><i className="fas fa-headset text-xl sm:text-2xl"></i></div>
                    <h3 className="font-black uppercase italic text-base sm:text-xl leading-none">{t('admin_support')}</h3>
                </div>
                <button onClick={onClose} className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center font-black text-lg">&times;</button>
            </div>
            <div className="flex-1 p-8 sm:p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 sm:mb-8 text-gray-200 text-3xl sm:text-4xl shadow-inner">
                    <i className="fas fa-clock"></i>
                </div>
                <p className="text-gray-300 font-black uppercase tracking-widest text-[9px] sm:text-[10px] leading-relaxed">Administrator is currently helping others.<br/>Please check back later.</p>
            </div>
        </div>
    );
};

const AuthModal: React.FC<{onClose: () => void, t: any}> = ({onClose, t}) => {
    // 0: Login, 1: Register, 2: Forgot Password
    const [authMode, setAuthMode] = useState(0); 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [age, setAge] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        try {
            if (authMode === 0) {
                await firebase.auth().signInWithEmailAndPassword(email, password);
                onClose();
            } else if (authMode === 1) {
                const { user: authUser } = await firebase.auth().createUserWithEmailAndPassword(email, password);
                await firebase.firestore().collection('users').doc(authUser.uid).set({
                    uid: authUser.uid, email, displayName: email.split('@')[0], points: 10, age: Number(age), address, phone,
                    settings: { autoShareContact: true, receiveNotifications: true, shareLocation: true, profileVisibility: 'public' }
                });
                onClose();
            } else if (authMode === 2) {
                await firebase.auth().sendPasswordResetEmail(email);
                alert(t('reset_link_sent'));
                setAuthMode(0);
            }
        } catch (err: any) { alert(err.message); }
        finally { setAuthLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[400] flex items-center justify-center p-4 backdrop-blur-xl" onClick={onClose}>
            <div className="bg-white w-full max-md rounded-2xl sm:rounded-[4rem] p-8 sm:p-12 relative shadow-2xl animate-in zoom-in duration-300 border-4 sm:border-8 border-white/20" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 sm:top-10 sm:right-10 text-2xl sm:text-3xl text-gray-200 hover:text-red-500 transition-colors">&times;</button>
                <h2 className="text-2xl sm:text-3xl font-black mb-8 sm:mb-12 text-center uppercase italic text-[#2c3e50] tracking-tighter">
                    {authMode === 0 ? t('login') : authMode === 1 ? t('register') : t('reset_password')}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="email" placeholder={t('email_address')} value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" required />
                    
                    {authMode !== 2 && (
                        <input type="password" placeholder={t('password')} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" required />
                    )}

                    {authMode === 1 && (
                        <>
                            <input type="number" placeholder={t('age')} value={age} onChange={e => setAge(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" required />
                            <input type="text" placeholder={t('phone_number')} value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" required />
                            <input type="text" placeholder={t('home_address')} value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" required />
                        </>
                    )}

                    <button type="submit" disabled={authLoading} className="w-full bg-[#3498db] text-white py-4 sm:py-6 rounded-full font-black text-lg sm:text-xl shadow-2xl mt-4 sm:mt-6 hover:scale-[1.03] transition-all uppercase tracking-tighter active:scale-95 disabled:opacity-50">
                        {authLoading ? '...' : authMode === 0 ? t('login') : authMode === 1 ? t('register') : t('confirm')}
                    </button>
                </form>

                <div className="flex flex-col gap-4 mt-8">
                    {authMode === 0 ? (
                        <>
                            <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#3498db] cursor-pointer hover:underline" onClick={() => setAuthMode(2)}>
                                {t('forgot_password')}
                            </p>
                            <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 cursor-pointer hover:text-[#3498db] transition-all" onClick={() => setAuthMode(1)}>
                                {t('register')}
                            </p>
                        </>
                    ) : authMode === 1 ? (
                        <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 cursor-pointer hover:text-[#3498db] transition-all" onClick={() => setAuthMode(0)}>
                            {t('login')}
                        </p>
                    ) : (
                        <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 cursor-pointer hover:text-[#3498db] transition-all" onClick={() => setAuthMode(0)}>
                            {t('cancel')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const RedeemConfirmModal: React.FC<{item: any, user: UserProfile, onCancel: () => void, onConfirm: (f: string, c: string) => void, t: any}> = ({item, user, onCancel, onConfirm, t}) => {
    const [fullName, setFullName] = useState(user.displayName || '');
    const [userClass, setUserClass] = useState('');
    return (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in" onClick={onCancel}>
            <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-[4rem] p-8 sm:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative ring-4 sm:ring-[12px] ring-white/10" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl sm:text-3xl font-black mb-6 italic uppercase text-[#2c3e50] text-center underline decoration-[#f39c12] decoration-4 sm:decoration-8 underline-offset-8 decoration-skip-ink">{t('confirm_redeem_title')}</h2>
                <p className="text-center text-gray-400 font-bold mb-8 sm:mb-10 leading-relaxed text-xs sm:text-base">Enter your registered details to verify collection eligibility.</p>
                <form onSubmit={e => { e.preventDefault(); onConfirm(fullName, userClass); }} className="space-y-4 sm:space-y-6">
                    <div className="space-y-1 sm:space-y-2">
                        <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">Full Registered Name</label>
                        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Mohd bin Ali" className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" required />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                        <label className="text-[8px] sm:text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">Class / Section</label>
                        <input value={userClass} onChange={e => setUserClass(e.target.value)} placeholder="e.g. 5 Amanah" className="w-full bg-gray-50 border-2 border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-[1.5rem] outline-none font-bold shadow-inner focus:border-[#3498db] transition-all text-sm" required />
                    </div>
                    <div className="bg-[#f39c12]/5 p-4 sm:p-8 rounded-xl sm:rounded-[2rem] text-center border-2 border-[#f39c12]/20 shadow-inner">
                        <p className="font-black text-lg sm:text-2xl italic text-[#2c3e50] uppercase leading-tight mb-1 sm:mb-2">{item.name}</p>
                        <p className="text-[#f39c12] font-black text-2xl sm:text-4xl tracking-tighter">-{item.cost} PTS</p>
                    </div>
                    <div className="flex gap-3 sm:gap-4 pt-4">
                        <button type="button" onClick={onCancel} className="flex-1 bg-gray-50 text-gray-400 py-4 sm:py-6 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all">{t('cancel')}</button>
                        <button type="submit" className="flex-1 bg-[#3498db] text-white py-4 sm:py-6 rounded-full font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-blue-600 transition-all">{t('confirm')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default App;
