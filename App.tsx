
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

    // Listen for user's chat rooms (Helper <-> Requester)
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
                // Count rooms where user is not the last sender
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
            if (isMenuOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
            if (isLangOpen && langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen, isLangOpen]);

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
            <header className="bg-[#2c3e50] text-white shadow-xl sticky top-0 z-[100] h-16 sm:h-20 flex items-center">
                <div className="container mx-auto px-4 flex items-center justify-between">
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(true); }} className="p-3 hover:bg-white/10 rounded-xl transition-all flex items-center gap-3">
                        <i className="fas fa-bars text-xl"></i>
                        <span className="hidden lg:inline font-bold uppercase tracking-widest text-xs">{t('menu')}</span>
                    </button>
                    <div className="flex-1 text-center font-black tracking-widest sm:tracking-[0.25em] cursor-pointer text-sm sm:text-xl" onClick={() => setPage('home')}>MIRI<span className="text-[#3498db]">CARE</span>CONNECT</div>
                    <div className="flex items-center gap-3 sm:gap-6">
                        <div className="bg-[#f39c12] px-4 py-2 rounded-full text-[10px] sm:text-xs font-black flex items-center gap-2 shadow-lg cursor-pointer" onClick={() => setPage('profile')}><i className="fas fa-coins"></i><span>{user?.points || 0} PTS</span></div>
                        {user ? (
                            <button onClick={handleLogout} className="hidden sm:block bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-5 py-2 rounded-full text-xs font-bold transition-all border border-red-500/20">{t('logout')}</button>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="bg-[#3498db] hover:bg-blue-600 px-6 py-2 rounded-full text-xs font-black uppercase tracking-tight shadow-lg transition-all">{t('login_register')}</button>
                        )}
                    </div>
                </div>
            </header>

            {(user?.isAdmin || user?.email === 'admin@gmail.com') && (
                <button onClick={() => setIsAdminPanelOpen(true)} className="fixed right-0 top-1/2 -translate-y-1/2 z-[90] bg-[#2c3e50] text-white p-4 rounded-l-2xl shadow-2xl hover:bg-[#3498db] transition-all group flex flex-col items-center gap-2 border-y border-l border-white/10">
                    <i className="fas fa-user-shield text-xl"></i>
                    <span className="[writing-mode:vertical-lr] font-black text-[10px] uppercase tracking-widest py-2">ADMIN PANEL</span>
                    <span className="bg-white/10 px-2 py-1 rounded text-[8px] font-black">P</span>
                </button>
            )}

            <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)} />
            <aside ref={sidebarRef} className={`fixed top-0 left-0 h-full w-[80vw] sm:w-[33.333333vw] bg-white z-[201] transform transition-transform duration-500 ease-out shadow-[10px_0_40px_rgba(0,0,0,0.2)] flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-8 sm:p-12 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-12">
                        <h2 className="text-2xl font-black italic tracking-tighter text-[#2c3e50] uppercase">Navigation</h2>
                        <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-gray-300 hover:text-red-500 transition-colors">&times;</button>
                    </div>
                    <nav className="flex flex-col gap-2 flex-1 overflow-y-auto pr-4 custom-scrollbar">
                        <MenuItem icon="home" label={t('home')} onClick={() => { setPage('home'); setIsMenuOpen(false); }} active={page === 'home'} />
                        <MenuItem icon="user" label={t('profile')} onClick={() => { setPage('profile'); setIsMenuOpen(false); }} active={page === 'profile'} />
                        <MenuItem icon="hands-helping" label={t('request_help')} onClick={() => { setPage('request-help'); setIsMenuOpen(false); }} active={page === 'request-help'} />
                        <MenuItem icon="handshake" label={t('offer_help')} onClick={() => { setPage('browse-requests'); setIsMenuOpen(false); }} active={page === 'browse-requests'} />
                        <MenuItem icon="shopping-cart" label={t('points_shop')} onClick={() => { setPage('shop'); setIsMenuOpen(false); }} active={page === 'shop'} />
                        <MenuItem icon="history" label={t('history')} onClick={() => { setPage('history'); setIsMenuOpen(false); }} active={page === 'history'} />
                        <MenuItem icon="cog" label={t('settings')} onClick={() => { setPage('settings'); setIsMenuOpen(false); }} active={page === 'settings'} />
                        <MenuItem icon="info-circle" label={t('about')} onClick={() => { setPage('about'); setIsMenuOpen(false); }} active={page === 'about'} />
                    </nav>
                </div>
            </aside>

            <main className="flex-1 container mx-auto px-4 py-8 sm:py-16 max-w-6xl animate-in fade-in duration-500">
                {page === 'home' && <HomePage onNavigate={setPage} t={t} />}
                {page === 'profile' && <ProfilePage user={user} setUser={setUser} t={t} onAuth={() => setIsAuthModalOpen(true)} onNavigate={setPage} />}
                {page === 'request-help' && <RequestHelpPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onNavigate={setPage} />}
                {page === 'browse-requests' && <BrowseRequestsPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} />}
                {page === 'shop' && <ShopPage user={user} setUser={setUser} t={t} onAuth={() => setIsAuthModalOpen(true)} onRedeemConfirm={setItemToRedeem} />}
                {page === 'history' && <HistoryPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onChat={openChat} />}
                {page === 'settings' && <SettingsPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} />}
                {page === 'about' && <AboutPage t={t} />}
            </main>

            <div className="fixed bottom-8 right-8 z-[150] flex flex-col items-end gap-5" ref={langDropdownRef}>
                {isLangOpen && (
                    <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-4 flex flex-col gap-2 border border-gray-100 min-w-[220px] animate-in slide-in-from-bottom-4 duration-300 ring-8 ring-white/10">
                        {Object.values(Language).map(l => (
                            <button key={l} onClick={() => { setLang(l); setIsLangOpen(false); }} className={`px-5 py-4 rounded-2xl text-xs font-black tracking-widest text-left flex items-center justify-between transition-all group ${lang === l ? 'bg-[#3498db]/10 text-[#3498db]' : 'text-gray-400 hover:bg-gray-50 hover:text-[#2c3e50]'}`}>
                                <span className="group-hover:translate-x-1 transition-transform">{langDisplayNames[l]}</span>
                                {lang === l && <i className="fas fa-check-circle text-lg"></i>}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex gap-4">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsChatHubOpen(!isChatHubOpen); setIsSupportOpen(false); }} 
                        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-white ring-8 ring-black/5 ${isChatHubOpen ? 'bg-[#27ae60]' : 'bg-white text-[#27ae60]'} relative`}
                    >
                        <i className={`fas fa-${isChatHubOpen ? 'times' : 'comments'} text-2xl`}></i>
                        {unreadChatCount > 0 && !isChatHubOpen && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-4 border-[#f8f9fa] shadow-lg animate-bounce">
                                {unreadChatCount}
                            </span>
                        )}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsSupportOpen(!isSupportOpen); setIsChatHubOpen(false); }} className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-white ring-8 ring-black/5 ${isSupportOpen ? 'bg-[#e74c3c]' : 'bg-[#3498db]'} text-white`}>
                        <i className={`fas fa-${isSupportOpen ? 'times' : 'comment-dots'} text-2xl`}></i>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsLangOpen(!isLangOpen); }} className="w-16 h-16 bg-[#2c3e50] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-white ring-8 ring-black/5">
                        <i className="fas fa-language text-3xl"></i>
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
                                if (!userDoc.exists) throw "User not found";
                                const currentPoints = userDoc.data().points || 0;
                                if (currentPoints < itemToRedeem.cost) throw "Insufficient points";
                                
                                transaction.update(userRef, { points: currentPoints - itemToRedeem.cost });
                                transaction.set(db.collection('redeem_history').doc(), {
                                    userId: user!.uid,
                                    userName: user!.displayName,
                                    fullName,
                                    userClass,
                                    itemName: itemToRedeem.name,
                                    itemPoints: itemToRedeem.cost,
                                    status: 'pending',
                                    redeemedAt: firebase.firestore.FieldValue.serverTimestamp()
                                });
                            });

                            setUser({...user!, points: user!.points - itemToRedeem.cost});
                            setItemToRedeem(null);
                            alert("Success! Your voucher is being processed.");
                        } catch (e: any) { 
                            alert("Failed: " + (typeof e === 'string' ? e : "Error occurred.")); 
                        }
                    }} 
                    t={t} 
                />
            )}
            <footer className="py-16 bg-transparent"></footer>
        </div>
    );
};

const MenuItem: React.FC<{icon: string, label: string, onClick: () => void, active?: boolean}> = ({icon, label, onClick, active}) => (
    <button onClick={onClick} className={`flex items-center gap-5 p-5 rounded-[2rem] transition-all group ${active ? 'bg-[#3498db] text-white shadow-xl scale-[1.02]' : 'text-gray-400 hover:bg-gray-50 hover:text-[#2c3e50]'}`}>
        <div className={`w-10 h-10 flex items-center justify-center rounded-2xl ${active ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-[#3498db]/10'}`}><i className={`fas fa-${icon} text-lg`}></i></div>
        <span className="font-black text-xs uppercase tracking-widest">{label}</span>
    </button>
);

const HomePage: React.FC<{onNavigate: (p: string) => void, t: any}> = ({onNavigate, t}) => (
    <div className="space-y-20">
        <section className="bg-gradient-to-tr from-[#2c3e50] to-[#34495e] text-white rounded-[3rem] p-10 sm:p-24 text-center shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
                <h1 className="text-4xl sm:text-7xl font-black mb-8 italic uppercase tracking-tighter">{t('hero_title')}</h1>
                <p className="text-lg sm:text-2xl mb-12 opacity-70 font-medium max-w-3xl mx-auto leading-relaxed">{t('hero_description')}</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => onNavigate('request-help')} className="bg-[#e74c3c] hover:bg-red-600 px-12 py-5 rounded-full font-black text-lg shadow-xl transition-all uppercase">{t('request_help')}</button>
                    <button onClick={() => onNavigate('browse-requests')} className="bg-white text-[#2c3e50] hover:bg-gray-100 px-12 py-5 rounded-full font-black text-lg shadow-xl transition-all uppercase">{t('offer_help')}</button>
                </div>
            </div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#3498db]/10 rounded-full blur-3xl"></div>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard num="1" title={t('step1_title')} desc={t('step1_desc')} />
            <StepCard num="2" title={t('step2_title')} desc={t('step2_desc')} />
            <StepCard num="3" title={t('step3_title')} desc={t('step3_desc')} />
        </div>
    </div>
);

const StepCard: React.FC<{num: string, title: string, desc: string}> = ({num, title, desc}) => (
    <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-xl hover:shadow-2xl transition-all text-center group">
        <div className="w-16 h-16 bg-gray-50 text-[#3498db] group-hover:bg-[#3498db] group-hover:text-white rounded-2xl flex items-center justify-center mx-auto mb-8 text-2xl font-black transition-all transform rotate-6 group-hover:rotate-0">{num}</div>
        <h3 className="text-xl font-black mb-4 uppercase italic text-[#2c3e50]">{title}</h3>
        <p className="text-gray-400 font-medium">{desc}</p>
    </div>
);

const ProfilePage: React.FC<{user: UserProfile | null, setUser: any, t: any, onAuth: () => void, onNavigate: any}> = ({user, setUser, t, onAuth, onNavigate}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ displayName: '', age: '', phone: '', address: '' });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                age: String(user.age || ''),
                phone: user.phone || '',
                address: user.address || ''
            });

            const db = firebase.firestore();
            db.collection('history')
                .where('userId', '==', user.uid)
                .limit(3)
                .get()
                .then((snap: any) => {
                    setRecentActivity(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
                });
        }
    }, [user]);

    if (!user) return (
        <div className="text-center py-40 bg-white rounded-[4rem] border border-gray-100 shadow-2xl max-w-2xl mx-auto px-8 relative overflow-hidden group">
            <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-10 text-4xl shadow-inner group-hover:rotate-12 transition-transform duration-500"><i className="fas fa-lock"></i></div>
            <h2 className="text-3xl font-black mb-6 uppercase italic tracking-tighter">Private Profile</h2>
            <p className="text-gray-400 mb-12 font-medium">Please sign in to view your personal dashboard and kindness stats.</p>
            <button onClick={onAuth} className="bg-[#3498db] text-white px-16 py-6 rounded-full font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">Sign In</button>
        </div>
    );

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const ageNum = Number(formData.age);
        if (ageNum < 12 || ageNum > 20) return alert(t('age_limit_error'));

        try {
            const db = firebase.firestore();
            const updatedProfile = {
                ...user,
                displayName: formData.displayName,
                age: ageNum,
                phone: formData.phone,
                address: formData.address
            };
            await db.collection('users').doc(user.uid).update(updatedProfile);
            setUser(updatedProfile);
            setIsEditing(false);
            alert(t('update_success'));
        } catch (e: any) { alert("Error updating profile: " + e.message); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            <div className="bg-[#2c3e50] text-white rounded-[4rem] p-10 sm:p-20 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-12 border-8 border-white/5">
                <div className="w-40 h-40 bg-gradient-to-tr from-[#3498db] to-[#2980b9] rounded-[3rem] flex items-center justify-center text-6xl shadow-2xl border-8 border-white/10 ring-4 ring-white/5 relative group">
                    <i className="fas fa-user"></i>
                    <div className="absolute -bottom-4 -right-4 bg-[#f39c12] text-white w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-xl border-4 border-[#2c3e50] animate-bounce">
                        <i className="fas fa-heart"></i>
                    </div>
                </div>
                <div className="flex-1 text-center md:text-left space-y-4">
                    <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter uppercase">{user.displayName}</h1>
                    <p className="text-blue-300 font-bold text-lg opacity-80 uppercase tracking-widest">{user.email}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
                        <div className="bg-white/10 px-8 py-3 rounded-2xl border border-white/10 flex items-center gap-4 group">
                            <i className="fas fa-coins text-[#f39c12] text-2xl group-hover:scale-110 transition-transform"></i>
                            <div>
                                <div className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">{t('points')}</div>
                                <div className="text-2xl font-black">{user.points}</div>
                            </div>
                        </div>
                        <div className="bg-white/10 px-8 py-3 rounded-2xl border border-white/10 flex items-center gap-4 group">
                            <i className="fas fa-award text-blue-400 text-2xl group-hover:scale-110 transition-transform"></i>
                            <div>
                                <div className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">{t('kindness_level')}</div>
                                <div className="text-2xl font-black uppercase italic tracking-tighter">Member</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-12">
                    <div className="bg-white p-10 sm:p-16 rounded-[4rem] shadow-2xl border border-gray-100 ring-8 ring-white/10 relative overflow-hidden">
                        <div className="flex justify-between items-center mb-12">
                            <h2 className="text-3xl font-black italic tracking-tighter uppercase text-[#2c3e50] underline decoration-[#3498db] decoration-8 underline-offset-8">{t('personal_info')}</h2>
                            <button onClick={() => setIsEditing(!isEditing)} className="bg-gray-50 text-[#2c3e50] px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-[#3498db] hover:text-white transition-all">
                                {isEditing ? t('cancel') : t('edit_profile')}
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('full_name')}</label>
                                    <input 
                                        type="text" 
                                        disabled={!isEditing}
                                        value={formData.displayName} 
                                        onChange={e => setFormData({...formData, displayName: e.target.value})} 
                                        className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] transition-all shadow-inner disabled:bg-gray-100 disabled:text-gray-400" required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('age')}</label>
                                    <input 
                                        type="number" 
                                        disabled={!isEditing}
                                        value={formData.age} 
                                        onChange={e => setFormData({...formData, age: e.target.value})} 
                                        className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] transition-all shadow-inner disabled:bg-gray-100 disabled:text-gray-400" required 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('phone_number')}</label>
                                <input 
                                    type="text" 
                                    disabled={!isEditing}
                                    value={formData.phone} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                                    className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] transition-all shadow-inner disabled:bg-gray-100 disabled:text-gray-400" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('home_address')}</label>
                                <textarea 
                                    rows={3}
                                    disabled={!isEditing}
                                    value={formData.address} 
                                    onChange={e => setFormData({...formData, address: e.target.value})} 
                                    className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] transition-all shadow-inner disabled:bg-gray-100 disabled:text-gray-400 resize-none" required 
                                />
                            </div>
                            
                            {isEditing && (
                                <button type="submit" className="w-full bg-[#3498db] text-white py-8 rounded-full font-black text-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter">
                                    {t('save_changes')}
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                <div className="space-y-12">
                    <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-2xl ring-8 ring-white/10">
                        <h2 className="text-2xl font-black italic tracking-tighter uppercase text-[#2c3e50] mb-8">{t('activity_summary')}</h2>
                        <div className="space-y-6">
                            {recentActivity.length === 0 ? (
                                <p className="text-gray-400 italic font-medium py-10 text-center">No recent activity recorded.</p>
                            ) : recentActivity.map((activity) => (
                                <div key={activity.id} className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex items-center gap-6 group hover:border-blue-200 transition-all cursor-pointer" onClick={() => onNavigate('history')}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${activity.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}>
                                        <i className={`fas fa-${activity.status === 'completed' ? 'check-circle' : 'hourglass-half'}`}></i>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[10px] font-black uppercase text-[#3498db] tracking-widest">{t(`category_${activity.category}`)}</div>
                                        <div className="font-black text-[#2c3e50] truncate max-w-[140px] italic uppercase tracking-tighter">{activity.name}</div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => onNavigate('history')} className="w-full py-4 text-[10px] font-black uppercase text-[#3498db] tracking-widest hover:bg-blue-50 rounded-2xl transition-all">
                                View All History <i className="fas fa-chevron-right ml-2"></i>
                            </button>
                        </div>
                    </div>

                    <div className="bg-gradient-to-tr from-[#3498db] to-[#2980b9] p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden ring-8 ring-white/10 group cursor-pointer" onClick={() => onNavigate('shop')}>
                        <div className="relative z-10 space-y-4">
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Kindness Vouchers</h3>
                            <p className="text-blue-100 font-bold opacity-80 italic">Redeem your hard-earned points for Miri local rewards!</p>
                            <div className="pt-4 flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                                Visit Shop <i className="fas fa-arrow-right group-hover:translate-x-2 transition-transform"></i>
                            </div>
                        </div>
                        <i className="fas fa-shopping-cart absolute -bottom-10 -right-10 text-white/10 text-9xl rotate-12 group-hover:scale-125 transition-transform duration-700"></i>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BrowseRequestsPage: React.FC<{user: UserProfile | null, t: any, onAuth: () => void}> = ({user, t, onAuth}) => {
    const [requests, setRequests] = useState<HelpRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const db = firebase.firestore();
        const unsubscribe = db.collection('requests').where('status', '==', 'pending').orderBy('createdAt', 'desc').onSnapshot((snap: any) => {
            setRequests(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleOfferHelp = async (req: HelpRequest) => {
        if (!user) return onAuth();
        if (user.uid === req.userId) return alert("You cannot fulfill your own requests.");
        if (!window.confirm("Do you want to share kindness? You will earn 5 points after the requester confirms receipt.")) return;

        const db = firebase.firestore();
        try {
            await db.collection('requests').doc(req.id).update({
                status: 'fulfilled',
                fulfilledBy: user.uid,
                fulfilledByName: user.displayName,
                fulfilledAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection('history').doc(req.id).update({
                status: 'fulfilled',
                fulfilledBy: user.uid,
                fulfilledByName: user.displayName,
                fulfilledAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Success! Your offer has been sent. Connect via chat to arrange handover.");
        } catch (e) { alert("Error connecting to server."); }
    };

    const handleDeleteRequest = async (id: string) => {
        if (!window.confirm("CONFIRMATION: Are you sure you want to permanently delete this request? This will remove it from the community board and your history log.")) return;
        const db = firebase.firestore();
        try {
            const batch = db.batch();
            batch.delete(db.collection('requests').doc(id));
            batch.delete(db.collection('history').doc(id));
            await batch.commit();
            alert("Request successfully removed from the system.");
        } catch (e: any) { 
            console.error("Delete error:", e);
            alert("Error deleting request: " + e.message); 
        }
    };

    if (!user) return (
        <div className="text-center py-40 bg-white rounded-[4rem] border border-gray-100 shadow-2xl max-w-2xl mx-auto px-8 relative overflow-hidden group">
            <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-10 text-4xl shadow-inner group-hover:rotate-12 transition-transform duration-500"><i className="fas fa-lock"></i></div>
            <h2 className="text-3xl font-black mb-6 uppercase italic tracking-tighter">Locked Channel</h2>
            <p className="text-gray-400 mb-12 font-medium">Only registered community members can browse and offer help to neighbors in need.</p>
            <button onClick={onAuth} className="bg-[#3498db] text-white px-16 py-6 rounded-full font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">Register / Sign In</button>
        </div>
    );

    if (loading) return <div className="text-center py-20"><i className="fas fa-spinner fa-spin text-3xl text-[#3498db]"></i></div>;

    return (
        <div className="space-y-16">
            <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter uppercase text-[#2c3e50]">{t('offer_help')}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {requests.length === 0 ? <p className="col-span-full text-center py-20 text-gray-300 font-bold uppercase tracking-widest italic text-xl">No Pending Requests In Miri.</p> : requests.map(req => (
                    <div key={req.id} className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl flex flex-col hover:border-[#3498db] transition-all group">
                        <div className="flex justify-between items-start mb-8">
                            <span className="bg-blue-50 text-[#3498db] px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{t(`category_${req.category}`)}</span>
                            <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${req.urgency === 'high' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>{t(`urgency_${req.urgency}`)}</span>
                        </div>
                        <h3 className="text-2xl font-black text-[#2c3e50] mb-2 uppercase italic tracking-tighter group-hover:text-[#3498db] transition-colors">{req.name}</h3>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-8"><i className="fas fa-map-marker-alt mr-2"></i>{req.address}</p>
                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 italic font-bold text-gray-500 mb-10 leading-relaxed shadow-inner flex-1">"{req.description}"</div>
                        <div className="flex gap-4">
                            <button onClick={() => handleOfferHelp(req)} disabled={req.userId === user.uid} className="flex-1 bg-[#3498db] text-white py-6 rounded-full font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed">(HELP)</button>
                            {user && req.userId === user.uid && (
                                <button onClick={() => handleDeleteRequest(req.id!)} className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-xl hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-500/20">
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HistoryPage: React.FC<{user: UserProfile | null, t: any, onAuth: any, onChat: (req: HelpRequest) => void}> = ({user, t, onAuth, onChat}) => {
    const [tab, setTab] = useState<'mine' | 'helped' | 'redeems'>('mine');
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        const db = firebase.firestore();
        let query;
        if (tab === 'mine') query = db.collection('history').where('userId', '==', user.uid);
        else if (tab === 'helped') query = db.collection('history').where('fulfilledBy', '==', user.uid);
        else query = db.collection('redeem_history').where('userId', '==', user.uid);

        return query.onSnapshot((snap: any) => {
            setData(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        });
    }, [user, tab]);

    const handleDeleteOwnRequest = async (id: string) => {
        if (!window.confirm("Did you really want to delete your request?")) return;
        if (!window.confirm("FINAL CONFIRMATION: Once deleted, this request will be purged from active boards and your history log. Continue?")) return;
        
        const db = firebase.firestore();
        const batch = db.batch();
        batch.delete(db.collection('requests').doc(id));
        batch.delete(db.collection('history').doc(id));
        
        try {
            await batch.commit();
            alert("Deleted successfully.");
        } catch (e) { alert("Error deleting request."); }
    };

    if (!user) return <div className="text-center py-40"><button onClick={onAuth} className="bg-[#3498db] text-white px-16 py-6 rounded-full font-black shadow-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Sign In to View History</button></div>;

    return (
        <div className="space-y-16">
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-[#2c3e50]">{t('history')}</h1>
            <div className="flex bg-white p-3 rounded-full border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
                {['mine', 'helped', 'redeems'].map(tabKey => (
                    <button key={tabKey} onClick={() => setTab(tabKey as any)} className={`flex-1 px-8 py-4 rounded-full font-black text-[10px] sm:text-xs transition-all uppercase whitespace-nowrap ${tab === tabKey ? 'bg-[#2c3e50] text-white shadow-lg scale-105' : 'text-gray-400'}`}>{t(tabKey === 'mine' ? 'my_requests' : tabKey === 'helped' ? 'helped_others' : 'redemptions')}</button>
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {data.length === 0 ? <p className="col-span-full text-center py-20 text-gray-300 font-bold uppercase tracking-widest italic text-xl">No permanent records.</p> : data.map((item) => (
                    <div key={item.id} className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl flex flex-col hover:border-[#3498db] transition-all relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-8">
                            <h3 className="font-black text-xl uppercase italic text-[#2c3e50]">{tab === 'redeems' ? item.itemName : t(`category_${item.category}`)}</h3>
                            {tab !== 'redeems' && <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase ${item.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{item.status}</span>}
                        </div>
                        <p className="text-gray-400 font-bold mb-10 italic leading-relaxed">"{item.description || 'Verified Community Contribution Voucher Exchange'}"</p>
                        <div className="flex flex-wrap gap-4 mt-auto">
                            {tab !== 'redeems' && item.status !== 'pending' && <button onClick={() => onChat(item)} className="bg-blue-50 text-blue-600 hover:bg-[#3498db] hover:text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 text-xs uppercase transition-all shadow-lg active:scale-95"><i className="fas fa-comments text-lg"></i>{t('chat')}</button>}
                            {item.status === 'fulfilled' && item.userId === user.uid && (
                                <button onClick={async () => { 
                                    if(confirm("Confirm help received? This Neighbor will earn 5 PTS for their kindness.")) { 
                                        const db = firebase.firestore();
                                        const b = db.batch();
                                        b.update(db.collection('requests').doc(item.id), {status: 'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp()}); 
                                        b.update(db.collection('history').doc(item.id), {status: 'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp()});
                                        b.update(db.collection('users').doc(item.fulfilledBy), {points: firebase.firestore.FieldValue.increment(5)}); 
                                        await b.commit();
                                        alert("Confirmed! Thank you for strengthening the Miri community."); 
                                    } 
                                }} className="bg-green-50 text-green-600 px-8 py-4 rounded-2xl font-black flex items-center gap-3 text-xs uppercase transition-all shadow-lg active:scale-95"><i className="fas fa-check-circle"></i>CONFIRM RECEIPT</button>
                            )}
                            {tab === 'mine' && item.status === 'pending' && (
                                <button onClick={() => handleDeleteOwnRequest(item.id)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 text-xs uppercase transition-all shadow-lg active:scale-95"><i className="fas fa-trash-alt"></i>DELETE</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ShopPage: React.FC<{user: UserProfile | null, setUser: any, t: any, onAuth: any, onRedeemConfirm: (item: any) => void}> = ({user, setUser, t, onAuth, onRedeemConfirm}) => {
    const shopItems = [{ id: '1', name: t('voucher_5'), cost: 20, color: '#27ae60' }, { id: '2', name: t('voucher_10'), cost: 40, color: '#3498db' }, { id: '3', name: t('voucher_15'), cost: 50, color: '#f39c12' }];
    return (
        <div className="space-y-16">
            <h1 className="text-4xl sm:text-6xl font-black text-center italic tracking-tighter uppercase text-[#2c3e50]">{t('points_shop')}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {shopItems.map(item => (
                    <div key={item.id} className="bg-white rounded-[3.5rem] border border-gray-100 overflow-hidden shadow-2xl hover:scale-[1.02] transition-all duration-300">
                        <div className="h-56 flex items-center justify-center relative bg-gray-50" style={{ borderBottom: `8px solid ${item.color}` }}>
                            <i className="fas fa-ticket-alt text-8xl opacity-10 absolute rotate-12"></i>
                            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl shadow-2xl" style={{ backgroundColor: item.color }}><i className="fas fa-gift"></i></div>
                        </div>
                        <div className="p-10 text-center">
                            <h3 className="font-black text-2xl mb-4 uppercase italic text-[#2c3e50]">{item.name}</h3>
                            <div className="text-[#f39c12] font-black text-4xl mb-10 flex items-center justify-center gap-3"><i className="fas fa-coins text-2xl"></i>{item.cost}</div>
                            <button onClick={() => { if(!user) return onAuth(); if(user.points < item.cost) return alert("Balance Insufficient: Help neighbors to earn more points!"); onRedeemConfirm(item); }} className="bg-[#2c3e50] text-white w-full py-6 rounded-full font-black shadow-xl hover:bg-[#34495e] transition-all uppercase text-xs tracking-widest ring-4 ring-[#2c3e50]/5">{t('redeem_now')}</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RequestHelpPage: React.FC<{user: UserProfile | null, t: any, onAuth: () => void, onNavigate: any}> = ({user, t, onAuth, onNavigate}) => {
    const [form, setForm] = useState({ name: '', address: '', age: '' as number | string, category: '', description: '', urgency: 'medium' as 'low' | 'medium' | 'high', pickupPoint: 'bilik_pengawas' });
    useEffect(() => { if (user) setForm(f => ({ ...f, name: user.displayName || '', address: user.address || '', age: user.age || '' })); }, [user]);
    
    const handlePostRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const db = firebase.firestore();
        const requestData = { 
            ...form, userId: user.uid, userName: user.displayName, userEmail: user.email, 
            phone: user.phone || 'Contact Private', status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(), points: 5 
        };
        try {
            const docRef = await db.collection('requests').add(requestData);
            await db.collection('history').doc(docRef.id).set({ ...requestData, id: docRef.id });
            alert("Your request had been posted successfully! Community members can now see it in Offer Help.");
            onNavigate('browse-requests');
        } catch (err) { alert("Error: " + (err as any).message); }
    };

    if (!user) return <div className="text-center py-40"><button onClick={onAuth} className="bg-[#3498db] text-white px-16 py-6 rounded-full font-black shadow-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Sign In to Post Request</button></div>;

    return (
        <div className="max-w-3xl mx-auto bg-white p-10 sm:p-24 rounded-[4rem] shadow-2xl relative overflow-hidden ring-8 ring-white/10">
            <h1 className="text-4xl sm:text-6xl font-black text-center mb-20 tracking-tighter italic uppercase text-[#2c3e50] underline decoration-[#3498db] decoration-8 underline-offset-8 decoration-skip-ink">{t('request_help')}</h1>
            <form onSubmit={handlePostRequest} className="space-y-12 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                    <div className="space-y-3"><label className="text-[10px] font-black text-gray-300 block uppercase tracking-widest ml-4">Receiver Name</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] transition-all shadow-inner" required /></div>
                    <div className="space-y-3"><label className="text-[10px] font-black text-gray-300 block uppercase tracking-widest ml-4">Registered Age (Auto)</label><input type="number" value={form.age} readOnly className="w-full border-2 border-gray-200 bg-gray-100 p-6 rounded-3xl outline-none font-bold text-gray-400 cursor-not-allowed shadow-inner" /></div>
                </div>
                <div className="space-y-3"><label className="text-[10px] font-black text-gray-300 block uppercase tracking-widest ml-4">Miri Neighborhood Address</label><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] transition-all shadow-inner" required /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                    <div className="space-y-3"><label className="text-[10px] font-black text-gray-300 block uppercase tracking-widest ml-4">Support Category</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] appearance-none shadow-inner" required><option value="">Item Category</option><option value="food">{t('category_food')}</option><option value="clothing">{t('category_clothing')}</option><option value="books">{t('category_books')}</option></select></div>
                    <div className="space-y-3"><label className="text-[10px] font-black text-gray-300 block uppercase tracking-widest ml-4">Pickup Hub</label><div className="bg-blue-50 text-[#3498db] p-6 rounded-3xl font-black text-center shadow-inner uppercase text-xs border border-blue-100">BILIK PENGAWAS</div></div>
                </div>
                <div className="space-y-3"><label className="text-[10px] font-black text-gray-300 block uppercase tracking-widest ml-4">Describe Specific Needs</label><textarea rows={5} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold focus:border-[#3498db] transition-all shadow-inner resize-none" required placeholder="Describe specifically what you need..." /></div>
                <button type="submit" className="w-full bg-[#2c3e50] text-white py-8 rounded-full font-black text-2xl shadow-2xl hover:bg-[#3498db] active:scale-95 transition-all uppercase tracking-tighter">Submit Help Request</button>
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
    return (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white w-full max-w-xl h-[85vh] rounded-[3rem] flex flex-col shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-[3rem]">
                    <div>
                        <h2 className="font-black text-2xl tracking-tighter italic uppercase text-[#3498db] truncate max-w-[300px]">
                            {chat.requestName || t(`category_${chat.requestCategory}`)}
                        </h2>
                        <p className="text-[10px] text-gray-300 font-black uppercase tracking-[0.2em] mt-1">
                            {chat.participantNames.find(n => n !== user.displayName) || "Neighbor"}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-white shadow-xl rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-all active:scale-90">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-white no-scrollbar">
                    {msgs.map(m => (
                        <div key={m.id} className={`flex flex-col ${m.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] font-black text-gray-200 mb-2 uppercase tracking-widest">{m.senderName}</span>
                            <div className={`px-8 py-5 rounded-[2.5rem] max-w-[85%] font-bold shadow-sm text-sm sm:text-base leading-relaxed ${m.senderId === user.uid ? 'bg-[#3498db] text-white rounded-tr-none' : 'bg-gray-100 text-gray-700 rounded-tl-none border border-gray-100'}`}>{m.text}</div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
                <form onSubmit={async (e) => { 
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
                }} className="p-8 bg-gray-50/80 rounded-b-[3rem] flex gap-4 border-t border-gray-100">
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('type_message')} className="flex-1 bg-white border border-gray-100 p-6 rounded-full outline-none font-bold shadow-inner focus:border-[#3498db] transition-all" />
                    <button type="submit" className="bg-[#3498db] text-white w-16 h-16 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all"><i className="fas fa-paper-plane text-xl"></i></button>
                </form>
            </div>
        </div>
    );
};

const ChatHubWindow: React.FC<{user: UserProfile | null, rooms: ChatRoom[], onClose: () => void, onSelectChat: (r: ChatRoom) => void, onAuth: () => void, t: any}> = ({user, rooms, onClose, onSelectChat, onAuth, t}) => {
    if (!user) return (
        <div className="fixed bottom-32 right-32 z-[150] bg-white w-[350px] rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-10 text-center animate-in zoom-in duration-300">
            <i className="fas fa-comments text-4xl text-gray-200 mb-6"></i>
            <h3 className="font-black uppercase italic text-[#2c3e50] mb-4">Messages</h3>
            <p className="text-gray-400 text-sm mb-8 font-medium">Please sign in to chat with your community neighbors.</p>
            <button onClick={onAuth} className="w-full bg-[#27ae60] text-white py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-xl">Sign In</button>
        </div>
    );

    return (
        <div className="fixed bottom-32 right-32 z-[150] bg-white w-[380px] h-[550px] max-h-[70vh] rounded-[3.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.25)] flex flex-col animate-in zoom-in duration-300 border border-gray-100 overflow-hidden ring-12 ring-black/5">
            <div className="p-8 bg-[#27ae60] text-white flex justify-between items-center rounded-t-[3.5rem] shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><i className="fas fa-comments text-xl"></i></div>
                    <div><h3 className="font-black uppercase tracking-tighter italic text-lg leading-none">{t('neighbor_chat')}</h3><p className="text-[9px] uppercase tracking-widest font-bold opacity-60">Connecting Kindness</p></div>
                </div>
                <button onClick={onClose} className="w-10 h-10 bg-black/10 rounded-full flex items-center justify-center hover:bg-black/20 transition-all">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-gray-50/50">
                {rooms.length === 0 ? (
                    <div className="text-center py-20 opacity-30 flex flex-col items-center">
                        <i className="fas fa-comment-slash text-5xl mb-4"></i>
                        <p className="font-black uppercase text-[10px] tracking-[0.2em]">No active conversations</p>
                    </div>
                ) : rooms.map(room => (
                    <div 
                        key={room.id} 
                        onClick={() => onSelectChat(room)}
                        className={`p-6 rounded-[2rem] border bg-white shadow-sm hover:border-[#27ae60] transition-all cursor-pointer group relative flex items-center gap-4 ${room.lastSenderId && room.lastSenderId !== user.uid ? 'border-l-8 border-l-[#27ae60]' : 'border-gray-100'}`}
                    >
                        <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-[#27ae60] font-black group-hover:bg-[#27ae60] group-hover:text-white transition-all">
                            {room.requestName?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-black uppercase italic tracking-tighter leading-tight truncate text-[#2c3e50]">{room.requestName || "Community Request"}</div>
                            <div className="text-[9px] font-bold text-[#27ae60] uppercase tracking-widest mt-1">
                                {room.participantNames.find(n => n !== user.displayName) || "Neighbor"}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium truncate mt-2">
                                {room.lastMessage || "Start a conversation..."}
                            </div>
                        </div>
                        {room.lastSenderId && room.lastSenderId !== user.uid && (
                            <div className="w-3 h-3 bg-[#27ae60] rounded-full animate-pulse shadow-lg"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const SupportWindow: React.FC<{user: UserProfile | null, onClose: () => void, onAuth: () => void, t: any}> = ({user, onClose, onAuth, t}) => {
    const [msgs, setMsgs] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;
        const db = firebase.firestore();
        const supportRef = db.collection('support_chats').doc(user.uid);
        return supportRef.collection('messages').orderBy('timestamp').onSnapshot((snap: any) => {
            setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        });
    }, [user]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

    if (!user) return (
        <div className="fixed bottom-32 right-8 z-[150] bg-white w-[350px] rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-10 text-center animate-in zoom-in duration-300">
            <i className="fas fa-user-lock text-4xl text-gray-200 mb-6"></i>
            <h3 className="font-black uppercase italic text-[#2c3e50] mb-4">Member Support</h3>
            <p className="text-gray-400 text-sm mb-8 font-medium">Please sign in to chat directly with our administration team.</p>
            <button onClick={onAuth} className="w-full bg-[#3498db] text-white py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-xl">Sign In</button>
        </div>
    );

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        const db = firebase.firestore();
        const supportRef = db.collection('support_chats').doc(user.uid);
        const msg = {
            senderId: user.uid,
            senderName: user.displayName,
            text: input,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: false
        };
        await supportRef.set({
            userId: user.uid,
            userName: user.displayName,
            userEmail: user.email,
            lastMessage: input,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await supportRef.collection('messages').add(msg);
        setInput('');
    };

    return (
        <div className="fixed bottom-32 right-8 z-[150] bg-white w-[380px] h-[550px] max-h-[70vh] rounded-[3.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.25)] flex flex-col animate-in zoom-in duration-300 border border-gray-100 overflow-hidden ring-12 ring-black/5">
            <div className="p-8 bg-[#3498db] text-white flex justify-between items-center rounded-t-[3.5rem] shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><i className="fas fa-headset text-xl"></i></div>
                    <div><h3 className="font-black uppercase tracking-tighter italic text-lg leading-none">{t('admin_support')}</h3><p className="text-[9px] uppercase tracking-widest font-bold opacity-60">Online Support Hub</p></div>
                </div>
                <button onClick={onClose} className="w-10 h-10 bg-black/10 rounded-full flex items-center justify-center hover:bg-black/20 transition-all">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar bg-gray-50/50">
                <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 text-center mb-4">
                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest italic">{t('support_desc')}</p>
                </div>
                {msgs.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                        <div className={`px-6 py-4 rounded-[1.8rem] max-w-[85%] font-bold shadow-sm text-sm leading-relaxed ${m.isAdmin ? 'bg-white text-gray-700 rounded-tl-none border border-gray-100' : 'bg-[#3498db] text-white rounded-tr-none'}`}>{m.text}</div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-gray-100 flex gap-4">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('type_message')} className="flex-1 bg-gray-50 border border-gray-100 p-4 rounded-full outline-none font-bold text-sm shadow-inner focus:border-[#3498db]" />
                <button type="submit" className="bg-[#3498db] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"><i className="fas fa-paper-plane"></i></button>
            </form>
        </div>
    );
};

const SettingsPage: React.FC<{user: UserProfile | null, t: any, onAuth: any}> = ({user, t, onAuth}) => (
    <div className="max-w-2xl mx-auto space-y-16 animate-in slide-in-from-bottom-8 duration-500">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase text-[#2c3e50]">{t('settings')}</h1>
        {!user ? <button onClick={onAuth} className="bg-[#3498db] text-white px-12 py-6 rounded-full font-black shadow-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Sign In to Edit Profile</button> : (
            <div className="bg-white rounded-[4rem] p-16 border border-gray-100 shadow-2xl space-y-12 ring-8 ring-white/10">
                <div className="space-y-6">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 ml-4">Community Identity</label>
                    <select className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-[2rem] font-bold shadow-inner outline-none focus:border-[#3498db] transition-all appearance-none cursor-pointer">
                        <option value="public">Active Member Mode</option>
                        <option value="private">Stealth Request Mode</option>
                    </select>
                </div>
                <button className="w-full bg-[#2c3e50] text-white py-8 rounded-full font-black shadow-2xl uppercase tracking-tighter active:scale-[0.98] transition-all hover:bg-[#34495e]">Apply Changes</button>
            </div>
        )}
    </div>
);

const AboutPage: React.FC<{t: any}> = ({t}) => (
    <div className="max-w-4xl mx-auto space-y-24 text-center animate-in zoom-in duration-700">
        <h1 className="text-6xl sm:text-8xl font-black italic uppercase tracking-tighter text-[#2c3e50] drop-shadow-sm">{t('about')}</h1>
        <div className="bg-white p-16 sm:p-32 rounded-[5rem] shadow-2xl space-y-12 border-2 border-gray-50 relative overflow-hidden group ring-12 ring-white/10">
            <div className="w-24 h-24 bg-blue-50 text-[#3498db] rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 text-4xl shadow-inner rotate-6 group-hover:rotate-0 transition-transform duration-500"><i className="fas fa-heart"></i></div>
            <h3 className="text-4xl font-black text-[#2c3e50] italic tracking-tight uppercase underline decoration-[#3498db] decoration-8 underline-offset-8">A Kindness Economy</h3>
            <p className="text-gray-400 text-xl sm:text-2xl font-bold leading-relaxed italic opacity-80">"Empowering the resource gap in Miri through non-monetary aid and community spirit."</p>
        </div>
    </div>
);

const AuthModal: React.FC<{onClose: () => void, t: any}> = ({onClose, t}) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [age, setAge] = useState('');
    const [address, setAddress] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const handleReset = async () => {
        if (!email.trim()) return alert("Security: Please provide your email address first.");
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            alert("A secure reset link has been dispatched to your email inbox.");
        } catch (e: any) { alert("Security Error: " + e.message); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        try {
            if (isLogin) {
                await firebase.auth().signInWithEmailAndPassword(email, password);
            } else {
                if (Number(age) < 12 || Number(age) > 20) throw new Error("Youth Hub Error: Age must be between 12 and 20.");
                if (!address.trim()) throw new Error("Location Error: Miri neighborhood address is mandatory.");
                
                const { user: authUser } = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const profile: UserProfile = {
                    uid: authUser.uid,
                    email,
                    displayName: email.split('@')[0],
                    points: 10,
                    age: Number(age),
                    address,
                    settings: { autoShareContact: true, receiveNotifications: true, shareLocation: true, profileVisibility: 'public' }
                };
                await firebase.firestore().collection('users').doc(authUser.uid).set(profile);
            }
            onClose();
        } catch (err: any) { alert(err.message); }
        finally { setAuthLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[400] flex items-center justify-center p-4 backdrop-blur-xl" onClick={onClose}>
            <div className="bg-white w-full max-w-md rounded-[4rem] p-10 sm:p-20 relative shadow-2xl animate-in zoom-in duration-300 border-8 border-white/20" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-10 right-10 text-3xl text-gray-200 hover:text-red-500 focus:outline-none">&times;</button>
                <h2 className="text-3xl font-black mb-12 text-center text-[#2c3e50] tracking-tighter italic uppercase underline decoration-[#3498db] decoration-8 underline-offset-8">{isLogin ? t('login') : t('register')}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#3498db] transition-all" required />
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#3498db] transition-all pr-14" 
                            required 
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)} 
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#3498db] transition-colors focus:outline-none"
                        >
                            <i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'} text-lg`}></i>
                        </button>
                    </div>
                    {!isLogin && (
                        <>
                            <input type="number" placeholder="Age (12-20)" value={age} onChange={e => setAge(e.target.value)} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#3498db] transition-all" required />
                            <input type="text" placeholder="Address in Miri" value={address} onChange={e => setAddress(e.target.value)} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#3498db] transition-all" required />
                        </>
                    )}
                    <button type="submit" disabled={authLoading} className="w-full bg-[#3498db] text-white py-6 rounded-full font-black text-xl shadow-2xl hover:scale-[1.03] active:scale-95 transition-all mt-4 uppercase tracking-tighter disabled:opacity-50">{authLoading ? 'Verifying...' : (isLogin ? t('login') : t('register'))}</button>
                </form>
                {isLogin && <button onClick={handleReset} className="mt-8 text-center w-full text-[10px] font-black text-blue-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Forgot Password?</button>}
                <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-300 cursor-pointer pt-6 hover:text-[#3498db] transition-all" onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Join Community" : "Registered? Sign In"}</p>
            </div>
        </div>
    );
};

const RedeemConfirmModal: React.FC<{item: any, user: UserProfile, onCancel: () => void, onConfirm: (f: string, c: string) => void, t: any}> = ({item, user, onCancel, onConfirm, t}) => {
    const [fullName, setFullName] = useState(user.displayName || '');
    const [userClass, setUserClass] = useState('');
    const h = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if(!fullName.trim() || !userClass.trim()) return alert("Verification Error: Name and Class required."); 
        onConfirm(fullName, userClass); 
    };
    return (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 sm:p-20 shadow-2xl relative ring-12 ring-white/10" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-3xl font-black mb-6 italic uppercase text-[#2c3e50] text-center underline decoration-[#f39c12] decoration-8 underline-offset-8">{t('confirm_redeem_title')}</h2>
                <p className="text-center text-gray-400 font-bold mb-10">{t('confirm_redeem_msg')}</p>
                <form onSubmit={h} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('full_name')}</label>
                        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name (for IC verification)" className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#3498db] transition-all" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('class_label')}</label>
                        <input value={userClass} onChange={e => setUserClass(e.target.value)} placeholder="e.g. Form 5 Amanah" className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#3498db] transition-all" required />
                    </div>
                    <div className="bg-[#f39c12]/10 p-8 rounded-[2.5rem] text-center border-[#f39c12]/20 border shadow-inner"><p className="font-black uppercase text-[#2c3e50] text-xl italic">{item.name}</p><p className="text-[#f39c12] font-black text-3xl tracking-tighter">-{item.cost} PTS</p></div>
                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onCancel} className="flex-1 bg-gray-100 text-gray-400 py-6 rounded-full font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all">{t('cancel')}</button>
                        <button type="submit" className="flex-1 bg-[#3498db] text-white py-6 rounded-full font-black uppercase tracking-widest text-xs shadow-xl hover:bg-blue-600 transition-all">{t('confirm')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminPanel: React.FC<{ onClose: () => void, t: any, user: UserProfile }> = ({ onClose, t, user }) => {
    const [tab, setTab] = useState<'users' | 'support'>('users');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [supportChats, setSupportChats] = useState<any[]>([]);
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
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

    const handleUpdateUser = async (updatedData: Partial<UserProfile>) => {
        if (!userToEdit) return;
        const db = firebase.firestore();
        try {
            await db.collection('users').doc(userToEdit.uid).update(updatedData);
            setUserToEdit(null);
            alert("User profile synchronized successfully.");
        } catch (e: any) {
            alert("Administrative Error: " + e.message);
        }
    };

    const handleResetPassword = async (email: string) => {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            alert(`A secure password reset link has been dispatched to: ${email}`);
        } catch (e: any) {
            alert("Security Error: " + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[4rem] flex flex-col shadow-2xl overflow-hidden ring-12 ring-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="font-black text-4xl tracking-tighter italic uppercase text-[#2c3e50]">{t('admin_panel')}</h2>
                        <div className="flex gap-4 mt-4">
                            <button onClick={() => setTab('users')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'users' ? 'bg-[#3498db] text-white' : 'bg-white border border-gray-200 text-gray-400 hover:text-[#3498db]'}`}>{t('user_management')}</button>
                            <button onClick={() => setTab('support')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'support' ? 'bg-[#3498db] text-white' : 'bg-white border border-gray-200 text-gray-400 hover:text-[#3498db]'}`}>{t('support_inbox')}</button>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-14 h-14 bg-white shadow-xl rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-all active:scale-90 text-2xl font-black">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 no-scrollbar bg-gray-50/20">
                    {loading ? (
                        <div className="text-center py-20"><i className="fas fa-spinner fa-spin text-3xl text-[#3498db]"></i></div>
                    ) : tab === 'users' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {users.map(u => (
                                <div key={u.uid} onClick={() => setUserToEdit(u)} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 flex items-center justify-between group hover:border-blue-500 hover:border-2 transition-all shadow-sm cursor-pointer hover:scale-[1.01]">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-gradient-to-tr from-[#3498db] to-[#2980b9] text-white rounded-[1.5rem] flex items-center justify-center text-2xl font-black shadow-lg group-hover:rotate-6 transition-transform">{u.displayName?.[0]?.toUpperCase() || '?'}</div>
                                        <div>
                                            <div className="font-black text-xl text-[#2c3e50] uppercase italic tracking-tighter">{u.displayName}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{u.email}</div>
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
                            <div className="md:col-span-1 space-y-4 overflow-y-auto no-scrollbar pr-2">
                                {supportChats.length === 0 ? (
                                    <p className="text-center py-20 text-gray-300 font-black uppercase italic text-xs">No active support threads</p>
                                ) : supportChats.map(c => (
                                    <div key={c.userId} onClick={() => setSelectedChat(c)} className={`p-6 rounded-[2rem] border transition-all cursor-pointer shadow-sm ${selectedChat?.userId === c.userId ? 'bg-[#3498db] border-transparent text-white' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                                        <div className="font-black uppercase italic tracking-tighter leading-tight">{c.userName}</div>
                                        <div className={`text-[10px] font-bold truncate mt-2 ${selectedChat?.userId === c.userId ? 'text-white/60' : 'text-gray-400'}`}>{c.lastMessage}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="md:col-span-2 h-full flex flex-col bg-white rounded-[3rem] border border-gray-100 shadow-xl relative">
                                {selectedChat ? (
                                    <AdminSupportChat chat={selectedChat} admin={user} />
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-gray-200">
                                        <i className="fas fa-comments text-6xl mb-6"></i>
                                        <p className="font-black uppercase tracking-widest text-xs italic">Select a user to start chatting</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {userToEdit && (
                <EditUserModal 
                    user={userToEdit} 
                    onClose={() => setUserToEdit(null)} 
                    onSave={handleUpdateUser} 
                    onResetPassword={handleResetPassword}
                    t={t}
                />
            )}
        </div>
    );
};

const EditUserModal: React.FC<{ user: UserProfile, onClose: () => void, onSave: (d: Partial<UserProfile>) => void, onResetPassword: (e: string) => void, t: any }> = ({ user, onClose, onSave, onResetPassword, t }) => {
    const [name, setName] = useState(user.displayName);
    const [points, setPoints] = useState(user.points);

    return (
        <div className="fixed inset-0 bg-black/80 z-[700] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-300" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-[4rem] p-10 sm:p-20 shadow-2xl relative ring-12 ring-white/10" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-3xl font-black mb-12 italic uppercase text-[#2c3e50] text-center underline decoration-[#3498db] decoration-8 underline-offset-8 decoration-skip-ink">{t('edit_user')}</h2>
                <div className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('full_name')}</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#3498db] transition-all" />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-gray-300 ml-4 tracking-widest">{t('points')}</label>
                        <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} className="w-full border-2 border-gray-100 bg-gray-50 p-6 rounded-3xl outline-none font-bold shadow-inner focus:border-[#f39c12] transition-all" />
                    </div>
                    <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-gray-300 tracking-widest">Security & Authentication</h4>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black uppercase tracking-tighter text-[#2c3e50]">Registered Email:</span>
                            <span className="text-[10px] font-bold text-blue-500 italic">{user.email}</span>
                        </div>
                        <button onClick={() => onResetPassword(user.email)} className="w-full py-4 bg-white border-2 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
                            Trigger Password Reset Email
                        </button>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-400 py-6 rounded-full font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all">{t('cancel')}</button>
                        <button onClick={() => onSave({ displayName: name, points: points })} className="flex-1 bg-[#3498db] text-white py-6 rounded-full font-black uppercase tracking-widest text-xs shadow-xl hover:bg-blue-600 transition-all">{t('save_changes')}</button>
                    </div>
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
        const msg = {
            senderId: admin.uid,
            senderName: "Administrator",
            text: input,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: true
        };
        await supportRef.update({
            lastMessage: input,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await supportRef.collection('messages').add(msg);
        setInput('');
    };

    return (
        <>
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-[3rem]">
                <div>
                    <h4 className="font-black uppercase italic tracking-tighter text-[#2c3e50]">{chat.userName}</h4>
                    <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">{chat.userEmail}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-xs shadow-inner"><i className="fas fa-circle"></i></div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                {msgs.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.isAdmin ? 'items-end' : 'items-start'}`}>
                        <div className={`px-6 py-4 rounded-[1.8rem] max-w-[85%] font-bold shadow-sm text-sm leading-relaxed ${m.isAdmin ? 'bg-[#3498db] text-white rounded-tr-none' : 'bg-gray-100 text-gray-700 rounded-tl-none border border-gray-100'}`}>{m.text}</div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
            <form onSubmit={handleSend} className="p-6 border-t border-gray-100 flex gap-4 rounded-b-[3rem]">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type admin reply..." className="flex-1 bg-gray-50 border border-gray-100 p-4 rounded-full outline-none font-bold text-sm shadow-inner focus:border-[#3498db]" />
                <button type="submit" className="bg-[#3498db] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"><i className="fas fa-paper-plane"></i></button>
            </form>
        </>
    );
};

export default App;
