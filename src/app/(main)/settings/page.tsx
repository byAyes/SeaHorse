'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Save,
  Mail,
  User,
  Key,
  Eye,
  EyeOff,
  Monitor,
  Moon,
  Sun,
  Camera,
  Globe,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAiStatus } from '@/lib/hooks/use-ai-status';
import { useProfile, useUpdateProfile, DEFAULT_USER_ID } from '@/lib/api-client';
import { useTheme } from '@/components/layout/theme-provider';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/toast';

export default function SettingsPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { showToast } = useToast();
  const { refetch: refetchAiStatus, ...aiStatus } = useAiStatus();

  // Profile form
  const [skillsInput, setSkillsInput] = useState('');
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');

  // API Keys
  const [showKeys, setShowKeys] = useState(false);
  const [jsearchKey, setJsearchKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [nimKey, setNimKey] = useState('');
  const [savedKeys, setSavedKeys] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);

  // Email config
  const [emailHost, setEmailHost] = useState('');
  const [emailPort, setEmailPort] = useState('587');
  const [emailUser, setEmailUser] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');

  // Load profile data when it arrives from API
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocation(profile.location || '');
      setRemoteOnly(profile.remoteOnly || false);
      setMinSalary(profile.minSalary?.toString() || '');
      setMaxSalary(profile.maxSalary?.toString() || '');
      setSkillsInput(profile.skills?.join(', ') || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({
        userId: DEFAULT_USER_ID,
        skills: skillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        location,
        remoteOnly,
        minSalary: minSalary ? Number(minSalary) : undefined,
        maxSalary: maxSalary ? Number(maxSalary) : undefined,
      });
      showToast('success', t('settings.saved'));
    } catch {
      showToast('error', t('settings.saveError'));
    }
  };

  const handleSaveKeys = async () => {
    setSavingKeys(true);
    try {
      const payload: Record<string, string> = {};
      if (jsearchKey) payload.jsearchApiKey = jsearchKey;
      if (geminiKey) payload.geminiApiKey = geminiKey;
      if (openrouterKey) payload.openrouterApiKey = openrouterKey;
      if (nimKey) payload.nimApiKey = nimKey;

      const res = await fetch('/api/config/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to save keys');
      }

      setSavedKeys(true);
      showToast('success', t('settings.saved'));
      // Refresh AI status badges and config summary immediately
      refetchAiStatus();
      setTimeout(() => setSavedKeys(false), 2000);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('settings.saveError'));
    } finally {
      setSavingKeys(false);
    }
  };

  const handleSaveEmail = () => {
    const config = {
      host: emailHost,
      port: emailPort,
      user: emailUser,
      pass: emailPass,
      from: emailFrom,
      to: emailTo,
      cc: emailCc,
    };
    localStorage.setItem('EMAIL_CONFIG', JSON.stringify(config));
    showToast('success', t('settings.saved'));
  };

  const languages = [
    { value: 'en' as const, label: 'English', native: 'English', short: 'EN' },
    { value: 'es' as const, label: 'Español', native: 'Español', short: 'ES' },
    { value: 'pt' as const, label: 'Português', native: 'Português', short: 'PT' },
    { value: 'fr' as const, label: 'Français', native: 'Français', short: 'FR' },
    { value: 'de' as const, label: 'Deutsch', native: 'Deutsch', short: 'DE' },
  ];

  const themeOptions = [
    {
      value: 'light' as const,
      label: t('settings.theme.light'),
      icon: <Sun size={16} />,
      description: t('settings.theme.light'),
    },
    {
      value: 'dark' as const,
      label: t('settings.theme.dark'),
      icon: <Moon size={16} />,
      description: 'Fondo oscuro, texto claro',
    },
    {
      value: 'system' as const,
      label: t('settings.theme.system'),
      icon: <Monitor size={16} />,
      description: 'Sigue la configuración del sistema',
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
              {!aiStatus.loading && !aiStatus.hasAiKey && (
                <Badge variant="warning" className="animate-pulse">
                  {t('settings.setupIncomplete')}
                </Badge>
              )}
              {!aiStatus.loading && aiStatus.hasAiKey && (
                <Badge variant="success">
                  {t('settings.setupComplete')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('settings.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/setup')}
            className="shrink-0 gap-2"
          >
            <Sparkles size={14} />
            {t('settings.rerunSetup')}
          </Button>
        </div>
      </motion.div>

      {/* Configuration Summary Card */}
      {!aiStatus.loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 size={16} className="text-primary" />
                {t('settings.configSummary.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    key: 'gemini' as const,
                    label: t('settings.apiKeys.gemini'),
                    icon: '🔷',
                  },
                  {
                    key: 'openrouter' as const,
                    label: t('settings.apiKeys.openrouter'),
                    icon: '🟣',
                  },
                  {
                    key: 'nim' as const,
                    label: t('settings.apiKeys.nim'),
                    icon: '💚',
                  },
                  {
                    key: 'jsearch' as const,
                    label: t('settings.apiKeys.jsearch'),
                    icon: '🔍',
                  },
                ].map((provider) => {
                  const isConfigured = aiStatus.configured[provider.key];
                  return (
                    <div
                      key={provider.key}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                        isConfigured
                          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10'
                          : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30'
                      }`}
                    >
                      <span className="text-lg shrink-0">{provider.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{provider.label}</p>
                        <p className="text-[11px] mt-0.5 flex items-center gap-1">
                          {isConfigured ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {t('common.configured')}
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                              <span className="text-slate-400 dark:text-slate-500">
                                {t('common.notConfigured')}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User size={16} className="text-primary" />
                {t('settings.profile.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Skills — standalone */}
              <Input
                label={t('settings.profile.skills')}
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder={t('settings.profile.skillsPlaceholder')}
              />

              {/* Location & remote — grouped */}
              <div className="pt-2">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t('settings.profile.locations')}
                </p>
                <div className="space-y-3">
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t('settings.profile.locationsPlaceholder')}
                  />
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={remoteOnly}
                        onChange={(e) => setRemoteOnly(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full dark:bg-slate-600" />
                    </label>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {t('settings.profile.remote')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Salary range — grouped */}
              <div className="pt-2">
                <div className="h-px bg-slate-200 dark:bg-slate-700 -mx-6 mb-4" />
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t('settings.profile.salaryRange')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                    placeholder="30000"
                  />
                  <Input
                    type="number"
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(e.target.value)}
                    placeholder="80000"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                  <Save size={14} />
                  {updateProfile.isPending
                    ? t('settings.profile.saving')
                    : t('settings.profile.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Email Config */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail size={16} className="text-primary" />
                {t('settings.email.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Server settings */}
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t('settings.email.server')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    value={emailHost}
                    onChange={(e) => setEmailHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                  <Input
                    type="number"
                    value={emailPort}
                    onChange={(e) => setEmailPort(e.target.value)}
                    placeholder="587"
                  />
                </div>
              </div>

              {/* Credentials */}
              <div className="h-px bg-slate-200 dark:bg-slate-700 -mx-6" />
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t('settings.email.credentials')}
                </p>
                <div className="space-y-3">
                  <Input
                    value={emailUser}
                    onChange={(e) => setEmailUser(e.target.value)}
                    placeholder="user@example.com"
                  />
                  <Input
                    type="password"
                    value={emailPass}
                    onChange={(e) => setEmailPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Addresses */}
              <div className="h-px bg-slate-200 dark:bg-slate-700 -mx-6" />
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t('settings.email.addresses')}
                </p>
                <div className="space-y-3">
                  <Input
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <Input
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="hr@company.com"
                  />
                  <Input
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    placeholder="bcc@example.com"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveEmail}>
                  <Save size={14} />
                  {t('settings.email.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* API Keys */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key size={16} className="text-primary" />
                {t('settings.apiKeys.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('settings.apiKeys.description')}
              </p>
              <div className="space-y-3">
                <Input
                  type={showKeys ? 'text' : 'password'}
                  value={jsearchKey}
                  onChange={(e) => setJsearchKey(e.target.value)}
                  placeholder="••••••••"
                />
                <Input
                  type={showKeys ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                />
                <Input
                  type={showKeys ? 'text' : 'password'}
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                />
                <Input
                  type={showKeys ? 'text' : 'password'}
                  value={nimKey}
                  onChange={(e) => setNimKey(e.target.value)}
                  placeholder="nvapi-..."
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowKeys(!showKeys)}>
                  {showKeys ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showKeys ? t('settings.apiKeys.hide') : t('settings.apiKeys.show')}
                </Button>
                <Button
                  onClick={handleSaveKeys}
                  disabled={savingKeys}
                  className="relative overflow-hidden"
                >
                  <motion.span
                    key={savedKeys ? 'check' : 'save'}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="inline-flex items-center gap-2"
                  >
                    <Save size={14} />
                    {savedKeys ? t('common.saved') : t('settings.apiKeys.save')}
                  </motion.span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Theme */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera size={16} className="text-primary" />
                {t('settings.theme.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {themeOptions.map((opt) => (
                  <motion.button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                      theme === opt.value
                        ? 'border-primary bg-primary-50 dark:bg-primary-50/5 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                    }`}
                  >
                    <motion.div
                      layoutId={`theme-icon-${opt.value}`}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        theme === opt.value
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-500 dark:bg-dark-surface-tertiary'
                      }`}
                    >
                      {opt.icon}
                    </motion.div>
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 text-center leading-tight">
                      {opt.description}
                    </span>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Language */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe size={16} className="text-primary" />
                {t('common.language')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {languages.map((lang) => {
                  const active = lang.value === locale;
                  return (
                    <motion.button
                      key={lang.value}
                      onClick={() => setLocale(lang.value)}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-colors ${
                        active
                          ? 'border-primary bg-primary-50 dark:bg-primary-50/5 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                      }`}
                    >
                      <motion.div
                        layoutId={`lang-icon-${lang.value}`}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${
                          active
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-500 dark:bg-dark-surface-tertiary'
                        }`}
                      >
                        {lang.short}
                      </motion.div>
                      <span className="text-xs font-medium truncate w-full text-center">
                        {lang.native}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
