import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AuthPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { session } = useAuth();

    // Auto-redirect if already logged in
    useEffect(() => {
        if (session) {
            navigate('/', { replace: true });
        }
    }, [session, navigate]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signIn({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/');
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                }, {
                    data: {
                        full_name: fullName,
                        age: 25,
                        gender: 'female',
                    },
                });
                if (error) throw error;
                alert('Registration successful! Please login.');
                setIsLogin(true);
            }
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background-light dark:bg-background-dark">
            <div className="w-full max-w-md p-6 bg-white dark:bg-[#231530] rounded-xl shadow-lg border border-gray-100 dark:border-[#352345]">
                <h1 className="text-2xl font-bold mb-6 text-center text-[#140c1d] dark:text-white">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h1>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-500 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="flex flex-col gap-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full p-3 rounded-lg border border-gray-200 dark:border-[#352345] bg-gray-50 dark:bg-[#1a0f26] text-[#140c1d] dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-[#352345] bg-gray-50 dark:bg-[#1a0f26] text-[#140c1d] dark:text-white outline-none focus:ring-2 focus:ring-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-[#352345] bg-gray-50 dark:bg-[#1a0f26] text-[#140c1d] dark:text-white outline-none focus:ring-2 focus:ring-primary"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-primary hover:underline"
                    >
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
