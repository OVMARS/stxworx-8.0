import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { confirmEmailVerification } from '../lib/api';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState<string>('Verifying your email...');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await confirmEmailVerification(token);
        setStatus('success');
        setMessage(response.message);
        setVerifiedEmail(response.email || null);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'Failed to verify email. The link may be expired or invalid.');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-ink">STXWORX</h1>
        </div>

        {/* Card */}
        <div className="card p-8 text-center">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            {status === 'verifying' && (
              <div className="w-16 h-16 bg-accent-cyan/10 rounded-full flex items-center justify-center">
                <Loader2 size={32} className="text-accent-cyan animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-green-600" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle size={32} className="text-red-600" />
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-black mb-2">
            {status === 'verifying' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h2>

          {/* Message */}
          <p className="text-muted mb-6">{message}</p>

          {/* Verified Email */}
          {verifiedEmail && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-[10px] mb-6">
              <p className="text-green-700 font-medium">{verifiedEmail}</p>
              <p className="text-xs text-green-600">This email is now verified</p>
            </div>
          )}

          {/* Actions */}
          {status !== 'verifying' && (
            <button
              onClick={() => navigate('/settings')}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Go to Settings
              <ArrowRight size={18} />
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted mt-6">
          {status === 'error' && (
            <>
              Need a new verification email?{' '}
              <a href="/settings" className="text-accent-orange hover:underline">
                Go to Settings
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
