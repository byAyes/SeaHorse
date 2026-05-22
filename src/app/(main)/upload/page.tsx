'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Wrench,
  MapPin,
  Briefcase,
  GraduationCap,
  FileText,
  Loader2,
  CheckCircle2,
  Circle,
  Search,
  BarChart3,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { Dropzone } from '@/components/upload/dropzone';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useUploadCv, useProcessCv, useMatchJobs, DEFAULT_USER_ID } from '@/lib/api-client';

type UploadStep = 'upload' | 'processing' | 'preview' | 'done';

interface ProcessStep {
  id: string;
  icon: React.ReactNode;
  labelKey: string;
  descKey: string;
  status: 'pending' | 'active' | 'done';
}

export default function UploadPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [uploadedCvId, setUploadedCvId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState<UploadStep>('upload');
  const [processStepIdx, setProcessStepIdx] = useState(0);

  const uploadCv = useUploadCv();
  const processCv = useProcessCv();
  const matchJobs = useMatchJobs({ userId: 'default-user', threshold: 0 });
  const { showToast } = useToast();

  // Processing steps
  const processSteps: ProcessStep[] = [
    {
      id: 'uploading',
      icon: <Upload size={16} />,
      labelKey: 'upload.processing.uploading',
      descKey: 'upload.processing.uploadingDesc',
      status: processStepIdx > 0 ? 'done' : processStepIdx === 0 ? 'active' : 'pending',
    },
    {
      id: 'extracting',
      icon: <Search size={16} />,
      labelKey: 'upload.processing.extracting',
      descKey: 'upload.processing.extractingDesc',
      status: processStepIdx > 1 ? 'done' : processStepIdx === 1 ? 'active' : 'pending',
    },
    {
      id: 'building',
      icon: <BarChart3 size={16} />,
      labelKey: 'upload.processing.building',
      descKey: 'upload.processing.buildingDesc',
      status: processStepIdx > 2 ? 'done' : processStepIdx === 2 ? 'active' : 'pending',
    },
  ];

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setStep('processing');
      setProcessStepIdx(0);

      await new Promise((r) => setTimeout(r, 400));

      try {
        const uploadResult = await uploadCv.mutateAsync({
          file: selectedFile,
          userId: DEFAULT_USER_ID,
        });
        setUploadedCvId(uploadResult.id);

        // Step 2: Extract
        setProcessStepIdx(1);
        await new Promise((r) => setTimeout(r, 300));

        showToast('info', t('upload.processing.extracting'));
        const processResult = await processCv.mutateAsync({
          cvId: uploadResult.id,
        });

        // Step 3: Build
        setProcessStepIdx(2);
        await new Promise((r) => setTimeout(r, 400));

        if (processResult.profile) {
          setProfileData(processResult.profile);
        }

        setStep('preview');
        showToast('success', t('upload.done.title'));
        matchJobs.refetch();
      } catch (err) {
        showToast(
          'error',
          t('upload.error.processingFailed'),
          err instanceof Error ? err.message : t('common.retry'),
        );
        setStep('upload');
        setFile(null);
        setProcessStepIdx(0);
      }
    },
    [uploadCv, processCv, matchJobs, showToast, t],
  );

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setProfileData(null);
    setUploadedCvId(null);
    setProcessStepIdx(0);
  }, []);

  const handleDone = useCallback(() => {
    setStep('done');
  }, []);

  const renderStepIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 size={20} className="text-emerald-500" />;
      case 'active':
        return (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Loader2 size={20} className="text-primary animate-spin" />
          </motion.div>
        );
      default:
        return <Circle size={20} className="text-slate-300 dark:text-slate-600" />;
    }
  };

  const skills = (profileData?.skills || []) as string[];
  const experience = (profileData?.experience || []) as Array<{
    role?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  const education = (profileData?.education || []) as Array<{
    degree?: string;
    institution?: string;
    field?: string;
  }>;
  const location = profileData?.location as string | undefined;
  const remoteOnly = profileData?.remoteOnly as boolean | undefined;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Upload size={18} className="text-primary shrink-0" />
            {t('upload.title')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {step === 'done' ? t('upload.done.successMessage') : t('upload.subtitle')}
          </p>
        </div>
        {step === 'upload' && (
          <div className="flex gap-2">
            <Link href="/pipeline">
              <Button variant="outline" size="sm">
                <PlayCircle size={14} />
                {t('dashboard.runPipeline')}
              </Button>
            </Link>
          </div>
        )}
      </motion.div>

      {/* ── STEP 1: Dropzone ── */}
      {(step === 'upload' || (step === 'processing' && !file)) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Dropzone onFileSelect={handleFileSelect} />
        </motion.div>
      )}

      {/* ── STEP 2: Processing ── */}
      {step === 'processing' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-xl mx-auto"
        >
          <Card>
            {/* Gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-6 py-6">
                {/* Pulsing status indicator */}
                <div className="relative">
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/20"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <FileText size={28} className="text-primary" />
                    </motion.div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-base font-semibold">{t('upload.processing.title')}</p>
                  <p className="text-sm text-slate-500 mt-1">{t('upload.processing.subtitle')}</p>
                </div>

                {/* Step progression */}
                <div className="w-full max-w-xs space-y-0">
                  {processSteps.map((ps, i) => (
                    <div key={ps.id} className="relative flex gap-4 pb-7 last:pb-0">
                      {i < processSteps.length - 1 && (
                        <motion.div
                          className="absolute left-[10px] top-8 h-full w-px"
                          initial={false}
                          animate={{
                            backgroundColor:
                              ps.status === 'done' ? 'rgb(16 185 129)' : 'rgb(203 213 225)',
                          }}
                          transition={{ duration: 0.3 }}
                        >
                          <motion.div
                            className="w-full bg-emerald-500"
                            initial={{ height: '0%' }}
                            animate={{
                              height: ps.status === 'done' ? '100%' : '0%',
                            }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </motion.div>
                      )}
                      <div className="relative z-10 flex-shrink-0 bg-surface dark:bg-dark-surface-secondary rounded-full p-0.5">
                        {renderStepIcon(ps.status)}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p
                          className={`text-sm font-medium ${
                            ps.status === 'pending'
                              ? 'text-slate-400 dark:text-slate-500'
                              : ps.status === 'active'
                                ? 'text-primary'
                                : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {t(ps.labelKey)}
                        </p>
                        {ps.status === 'active' ? (
                          <motion.p
                            className="text-xs text-slate-500 mt-0.5"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            {t(ps.descKey)}
                          </motion.p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {ps.status === 'done'
                              ? t('pipeline.status.completed')
                              : t('pipeline.status.pending')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── STEP 3: Profile Preview ── */}
      {step === 'preview' && profileData && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 sm:gap-6 md:grid-cols-2"
          >
            {/* Skills */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card hover className="relative overflow-hidden h-full">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Wrench size={15} className="text-primary" />
                    {t('upload.results.skills')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((skill: string, si: number) => (
                        <motion.span
                          key={skill}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: 0.1 + si * 0.025,
                            type: 'spring',
                            stiffness: 200,
                          }}
                        >
                          <Badge variant={si < 3 ? 'success' : 'default'}>{skill}</Badge>
                        </motion.span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Wrench size={20} className="text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-500">{t('common.noData')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Experience */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card hover className="relative overflow-hidden h-full">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Briefcase size={15} className="text-primary" />
                    {t('upload.results.experience')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {experience.length > 0 ? (
                    <ul className="space-y-3">
                      {experience.map((exp: { role?: string; company?: string }, i: number) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.05 }}
                          className="flex items-start gap-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {exp.company?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{exp.role}</p>
                            {exp.company && <p className="text-xs text-slate-500">{exp.company}</p>}
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Briefcase size={20} className="text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-500">{t('common.noData')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Education */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card hover className="relative overflow-hidden h-full">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <GraduationCap size={15} className="text-primary" />
                    {t('upload.results.education')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {education.length > 0 ? (
                    <ul className="space-y-3">
                      {(education as Array<{ degree?: string; institution?: string }>).map(
                        (edu: { degree?: string; institution?: string }, i: number) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + i * 0.05 }}
                            className="flex items-start gap-3"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {edu.institution?.charAt(0)?.toUpperCase() || 'E'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {edu.degree || t('common.noData')}
                              </p>
                              {edu.institution && (
                                <p className="text-xs text-slate-500">{edu.institution}</p>
                              )}
                            </div>
                          </motion.li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <GraduationCap
                        size={20}
                        className="text-slate-300 dark:text-slate-600 mb-2"
                      />
                      <p className="text-sm text-slate-500">{t('common.noData')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Location & Remote */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card hover className="relative overflow-hidden h-full">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin size={15} className="text-primary" />
                    {t('upload.results.locations')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 mb-3">
                      <MapPin size={20} className="text-amber-500" />
                    </div>
                    <p className="text-sm font-medium">{location || t('common.noData')}</p>
                    <Badge variant={remoteOnly ? 'success' : 'outline'} className="mt-2">
                      {remoteOnly
                        ? t('settings.profile.remoteYes')
                        : t('settings.profile.remoteNo')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Action Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-dark-surface-secondary p-4 sm:px-6"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {skills.length} {t('upload.results.skills').toLowerCase()}
              </span>
              {' · '}
              {experience.length} {t('upload.results.experience').toLowerCase()}
              {' · '}
              {education.length} {t('upload.results.education').toLowerCase()}
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={reset} size="sm" className="flex-1 sm:flex-none">
                <RefreshCw size={14} />
                {t('upload.preview.reupload')}
              </Button>
              <Button onClick={handleDone} size="sm" className="flex-1 sm:flex-none">
                <CheckCircle2 size={14} />
                {t('upload.preview.confirm')}
              </Button>
            </div>
          </motion.div>
        </>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          {/* Success card */}
          <Card className="relative overflow-hidden text-center">
            {/* Gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <CardContent className="pt-8 pb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                className="flex justify-center mb-4"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                  <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
                </div>
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-bold"
              >
                {t('upload.done.title')}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-slate-500 mt-2 max-w-sm mx-auto"
              >
                {t('upload.done.subtitle')}
              </motion.p>

              {/* Profile summary chips */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap justify-center gap-2 mt-5"
              >
                <Badge variant="success" className="gap-1.5">
                  <Wrench size={11} />
                  {skills.length} {t('upload.results.skills').toLowerCase()}
                </Badge>
                <Badge variant="default" className="gap-1.5">
                  <Briefcase size={11} />
                  {experience.length} {t('upload.results.experience').toLowerCase()}
                </Badge>
                <Badge variant="default" className="gap-1.5">
                  <GraduationCap size={11} />
                  {education.length} {t('upload.results.education').toLowerCase()}
                </Badge>
                {location && (
                  <Badge variant="outline" className="gap-1.5">
                    <MapPin size={11} />
                    {location}
                  </Badge>
                )}
              </motion.div>
            </CardContent>
          </Card>

          {/* Action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: <BarChart3 size={18} />,
                label: t('upload.done.viewJobs'),
                desc: t('dashboard.actions.viewJobsDesc'),
                href: '/jobs',
                color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
              },
              {
                icon: <PlayCircle size={18} />,
                label: t('upload.done.runPipeline'),
                desc: t('dashboard.actions.runPipelineDesc'),
                href: '/pipeline',
                color:
                  'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
              },
              {
                icon: <Upload size={18} />,
                label: t('upload.done.uploadAnother'),
                desc: t('upload.subtitle'),
                href: null,
                color: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
                onClick: reset,
              },
            ].map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 200 }}
              >
                {action.href ? (
                  <Link href={action.href}>
                    <Card hover className="h-full cursor-pointer group">
                      <CardContent className="flex flex-col items-center text-center gap-3 pt-6">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} group-hover:scale-110 transition-transform duration-200`}
                        >
                          {action.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{action.label}</p>
                          <p className="text-xs text-slate-500 mt-1">{action.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : (
                  <div onClick={action.onClick} className="cursor-pointer h-full">
                    <Card hover className="h-full group">
                      <CardContent className="flex flex-col items-center text-center gap-3 pt-6">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} group-hover:scale-110 transition-transform duration-200`}
                        >
                          {action.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{action.label}</p>
                          <p className="text-xs text-slate-500 mt-1">{action.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
