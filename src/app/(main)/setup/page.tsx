'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  User,
  Mail,
  Zap,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  Globe,
  Wrench,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { useAiStatus } from '@/lib/hooks/use-ai-status';

const TOTAL_STEPS = 5;

type WizardStep = {
  id: string;
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
};

export default function SetupPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [geminiKey, setGeminiKey] = useState('');
  const [jsearchKey, setJsearchKey] = useState('');
  const [skills, setSkills] = useState('');
  const [location, setLocation] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const aiStatus = useAiStatus();
  const [prefilled, setPrefilled] = useState({ geminiKey: false, jsearchKey: false, profile: false });

  // Detect which steps are already configured on mount
  useEffect(() => {
    if (aiStatus.loading) return;
    setPrefilled({
      geminiKey: aiStatus.configured.gemini || aiStatus.configured.openrouter || aiStatus.configured.nim,
      jsearchKey: aiStatus.configured.jsearch,
      profile: (() => {
        try {
          return !!localStorage.getItem('USER_PROFILE');
        } catch { return false; }
      })(),
    });
  }, [aiStatus.loading, aiStatus.configured]);

  const steps: WizardStep[] = [
    {
      id: 'welcome',
      icon: <Sparkles size={20} />,
      titleKey: 'setup.welcome.title',
      descKey: 'setup.welcome.desc',
    },
    {
      id: 'ai-key',
      icon: <Key size={20} />,
      titleKey: 'setup.aiKey.title',
      descKey: 'setup.aiKey.desc',
    },
    {
      id: 'jsearch',
      icon: <Globe size={20} />,
      titleKey: 'setup.jsearch.title',
      descKey: 'setup.jsearch.desc',
    },
    {
      id: 'profile',
      icon: <User size={20} />,
      titleKey: 'setup.profile.title',
      descKey: 'setup.profile.desc',
    },
    {
      id: 'done',
      icon: <CheckCircle2 size={20} />,
      titleKey: 'setup.done.title',
      descKey: 'setup.done.desc',
    },
  ];

  const handleNext = async () => {
    // On step 4 (index 3 = profile), save API keys before moving on
    if (step === 3) {
      setSaving(true);
      try {
        const payload: Record<string, string> = {};
        if (geminiKey) payload.geminiApiKey = geminiKey;
        if (jsearchKey) payload.jsearchApiKey = jsearchKey;

        if (Object.keys(payload).length > 0) {
          const res = await fetch('/api/config/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to save' }));
            throw new Error(err.error || 'Failed to save keys');
          }
        }

        // Save profile to local storage
        localStorage.setItem(
          'USER_PROFILE',
          JSON.stringify({
            skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
            location,
          }),
        );

        setSaving(false);
        setCompleted(true);
        setStep(4);
        showToast('success', t('setup.saved'));
      } catch (err) {
        setSaving(false);
        showToast('error', t('common.error'), err instanceof Error ? err.message : undefined);
      }
      return;
    }

    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  function markSetupSeen() {
    try {
      localStorage.setItem('seahorse_setup_seen', 'true');
    } catch {
      // localStorage unavailable
    }
  }

  const handleFinish = () => {
    markSetupSeen();
    router.push('/dashboard');
  };

  const handleSkip = async () => {
    // Save whatever we have
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (geminiKey) payload.geminiApiKey = geminiKey;
      if (jsearchKey) payload.jsearchApiKey = jsearchKey;

      if (Object.keys(payload).length > 0) {
        await fetch('/api/config/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (skills || location) {
        localStorage.setItem(
          'USER_PROFILE',
          JSON.stringify({
            skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
            location,
          }),
        );
      }

      setSaving(false);
      markSetupSeen();
      setCompleted(true);
      setStep(4);
      showToast('success', t('setup.saved'));
    } catch {
      setSaving(false);
      markSetupSeen();
      router.push('/dashboard');
    }
  };

  // Returns 'prefilled' if step is already configured, 'active'/'pending' otherwise
  const getStepStatus = (i: number): 'prefilled' | 'active' | 'pending' => {
    if (aiStatus.loading) return 'pending';
    if (i === 1 && prefilled.geminiKey) return 'prefilled';
    if (i === 2 && prefilled.jsearchKey) return 'prefilled';
    if (i === 3 && prefilled.profile) return 'prefilled';
    return 'pending';
  };

  const progress = ((step) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-xl sm:text-2xl font-semibold flex items-center justify-center gap-2">
          <Zap size={22} className="text-primary" />
          {t('setup.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('setup.subtitle')}
        </p>
      </motion.div>

      {/* Progress Bar */}
      <div className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between">
        {steps.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step || (i === step && completed);
          return (              <div
                key={s.id}
                className="flex flex-col items-center gap-1.5"
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    backgroundColor: isDone
                      ? 'rgb(16 185 129)'
                      : isActive
                        ? 'rgb(79 70 229)'
                        : i > 0 && getStepStatus(i) === 'prefilled'
                          ? 'rgb(16 185 129)'
                          : 'rgb(203 213 225)',
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-bold transition-colors ${
                    isDone
                      ? 'bg-emerald-500'
                      : isActive
                        ? 'bg-primary'
                        : i > 0 && getStepStatus(i) === 'prefilled'
                          ? 'bg-emerald-400'
                          : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  {isDone || (i > 0 && getStepStatus(i) === 'prefilled') ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    i + 1
                  )}
                </motion.div>
              <span
                className={`text-[10px] font-medium text-center leading-tight max-w-[64px] ${
                  isActive
                    ? 'text-primary'
                    : isDone || (i > 0 && getStepStatus(i) === 'prefilled')
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400'
                }`}
              >
                {t('setup.step.' + s.id)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <Card className="relative overflow-hidden">
            {/* Gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {steps[step].icon}
                </span>
                {t(steps[step].titleKey)}
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t(steps[step].descKey)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ── Step 0: Welcome ── */}
              {step === 0 && (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        icon: <Key size={18} />,
                        label: t('setup.welcome.step1'),
                        desc: t('setup.welcome.step1Desc'),
                        color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10',
                      },
                      {
                        icon: <Globe size={18} />,
                        label: t('setup.welcome.step2'),
                        desc: t('setup.welcome.step2Desc'),
                        color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
                      },
                      {
                        icon: <User size={18} />,
                        label: t('setup.welcome.step3'),
                        desc: t('setup.welcome.step3Desc'),
                        color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
                      },
                      {
                        icon: <Mail size={18} />,
                        label: t('setup.welcome.step4'),
                        desc: t('setup.welcome.step4Desc'),
                        color: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10',
                      },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.08 }}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 1: AI API Key ── */}
              {step === 1 && (
                <div className="space-y-4 py-2">
                  {prefilled.geminiKey && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-3 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                        {t('setup.preconfigured')}
                      </span>
                    </div>
                  )}
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>{t('setup.aiKey.recommended')}:</strong>{' '}
                      {t('setup.aiKey.recommendedDesc')}
                    </p>
                  </div>

                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..." 
                    label={t('settings.apiKeys.gemini')}
                  />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showKey ? t('settings.apiKeys.hide') : t('settings.apiKeys.show')}
                    </Button>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <p>{t('setup.aiKey.howTo')}</p>
                    <ol className="list-decimal list-inside space-y-1 mt-2">
                      <li>{t('setup.aiKey.howTo1')}</li>
                      <li>{t('setup.aiKey.howTo2')}</li>
                      <li>{t('setup.aiKey.howTo3')}</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* ── Step 2: JSearch Key (optional) ── */}
              {step === 2 && (
                <div className="space-y-4 py-2">
                  {prefilled.jsearchKey && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-3 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                        {t('setup.preconfigured')}
                      </span>
                    </div>
                  )}
                  <Input
                    type="password"
                    value={jsearchKey}
                    onChange={(e) => setJsearchKey(e.target.value)}
                    placeholder="sk-..."
                    label={t('settings.apiKeys.jsearch')}
                  />

                  <div className="text-xs text-slate-500">
                    <p>{t('setup.jsearch.optional')}</p>
                    <p className="mt-1">
                      {t('setup.jsearch.free')}:{' '}
                      <a
                        href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {t('setup.jsearch.getKey')}
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 3: Profile ── */}
              {step === 3 && (
                <div className="space-y-4 py-2">
                  {prefilled.profile && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-3 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                        {t('setup.preconfigured')}
                      </span>
                    </div>
                  )}
                  <Input
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder={t('setup.profile.skillsPlaceholder')}
                    label={t('setup.profile.skills')}
                  />

                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t('setup.profile.locationPlaceholder')}
                    label={t('setup.profile.location')}
                  />

                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-xs text-slate-500">
                      {t('setup.profile.optionalDesc')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('setup.profile.canEditLater')}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 4: Done ── */}
              {step === 4 && (
                <div className="flex flex-col items-center py-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 mb-4"
                  >
                    <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
                  </motion.div>
                  <h3 className="text-lg font-bold">{t('setup.done.title')}</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-sm">
                    {t('setup.done.nextSteps')}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-5">
                    {geminiKey && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 px-3 py-1 text-xs font-medium">
                        <Key size={11} /> {t('setup.done.aiConfigured')}
                      </span>
                    )}
                    {jsearchKey && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-3 py-1 text-xs font-medium">
                        <Globe size={11} /> {t('setup.done.jsearchConfigured')}
                      </span>
                    )}
                    {skills && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 px-3 py-1 text-xs font-medium">
                        <Wrench size={11} /> {skills.split(',').length} {t('setup.done.skillsAdded')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && !completed && (
            <Button variant="outline" onClick={handlePrev} disabled={saving}>
              <ChevronLeft size={14} />
              {t('common.back')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step < 4 && !completed && (
            <Button variant="ghost" size="sm" onClick={handleSkip} disabled={saving}>
              {t('setup.skip')}
            </Button>
          )}
          {step < 4 && (
            <Button
              onClick={handleNext}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t('common.saving')}
                </>
              ) : step === 3 ? (
                <>
                  <CheckCircle2 size={14} />
                  {t('setup.finish')}
                </>
              ) : (
                <>
                  {t('common.next')}
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          )}
          {completed && (
            <Button onClick={handleFinish} className="bg-emerald-600 hover:bg-emerald-700">
              <Zap size={14} />
              {t('setup.goToDashboard')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
