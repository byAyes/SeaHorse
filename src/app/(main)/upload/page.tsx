'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wrench, MapPin, Briefcase, GraduationCap } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Dropzone } from '@/components/upload/dropzone';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToastStore, ToastContainer } from '@/components/ui/toast';
import { useUploadCv, useProcessCv, useMatchJobs, DEFAULT_USER_ID } from '@/lib/api-client';

export default function UploadPage() {
  const { t } = useTranslation();
  const [, setFile] = useState<File | null>(null);
  const [, setUploadedCvId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState<'upload' | 'processing' | 'preview' | 'done'>('upload');

  const uploadCv = useUploadCv();
  const processCv = useProcessCv();
  const matchJobs = useMatchJobs({ userId: 'default-user', threshold: 0 });

  // API key resolution is handled server-side via config store
  // (saved via Settings page) or environment variables.

  const { toasts, showToast, dismissToast } = useToastStore();

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setStep('processing');
      showToast('info', t('upload.dropzone.uploading'));

      try {
        const uploadResult = await uploadCv.mutateAsync({
          file: selectedFile,
          userId: DEFAULT_USER_ID,
        });
        setUploadedCvId(uploadResult.id);

        showToast('info', t('upload.processing.extracting'));
        const processResult = await processCv.mutateAsync({
          cvId: uploadResult.id,
        });

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
          err instanceof Error ? err.message : 'Intenta de nuevo',
        );
        setStep('upload');
      }
    },
    [uploadCv, processCv, matchJobs, showToast, t],
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        {' '}
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="inline-block w-1.5 h-6 rounded-full bg-primary" />
          {t('upload.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('upload.subtitle')}</p>
      </motion.div>

      {/* Dropzone */}
      {(step === 'upload' || step === 'processing') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Dropzone onFileSelect={handleFileSelect} />
        </motion.div>
      )}

      {/* Processing state */}
      {step === 'processing' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Card>
            <CardContent>
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="relative">
                  <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div className="h-3 w-3 rounded-full bg-primary/60" />
                  </motion.div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{t('upload.processing.title')}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                    />
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
                    />
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
                    />
                    <span className="text-xs text-slate-500 ml-1">
                      {t('upload.processing.extracting')}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Profile Preview */}
      {step === 'preview' && profileData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {/* Skills */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench size={16} className="text-primary" />
                  {t('upload.results.skills')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {((profileData.skills || []) as string[]).map((skill: string, si: number) => (
                    <motion.span
                      key={skill}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + si * 0.03, type: 'spring', stiffness: 200 }}
                    >
                      <Badge>{skill}</Badge>
                    </motion.span>
                  ))}
                  {(!profileData.skills ||
                    !Array.isArray(profileData.skills) ||
                    (profileData.skills as string[]).length === 0) && (
                    <p className="text-sm text-slate-500">
                      {t('upload.results.skills')} {t('common.noData')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Experience */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase size={16} className="text-primary" />
                  {t('upload.results.experience')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(profileData.experience) && profileData.experience.length > 0 ? (
                  <ul className="space-y-2">
                    {(profileData.experience as Array<{ role?: string; company?: string }>).map(
                      (exp: { role?: string; company?: string }, i: number) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.05 }}
                          className="text-sm"
                        >
                          <span className="font-medium">{exp.role}</span>
                          {exp.company && <span className="text-slate-500"> en {exp.company}</span>}
                        </motion.li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    {t('upload.results.experience')} {t('common.noData')}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Location & Remote */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin size={16} className="text-primary" />
                  {t('upload.results.locations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{(profileData.location as string) || t('common.noData')}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {profileData.remoteOnly
                    ? t('settings.profile.remoteYes')
                    : t('settings.profile.remoteNo')}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Education */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap size={16} className="text-primary" />
                  {t('upload.results.education')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(profileData.education) && profileData.education.length > 0 ? (
                  <ul className="space-y-2">
                    {(
                      profileData.education as Array<{ degree?: string; institution?: string }>
                    ).map((edu: { degree?: string; institution?: string }, i: number) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.05 }}
                        className="text-sm"
                      >
                        <span className="font-medium">{edu.degree}</span>
                        {edu.institution && (
                          <span className="text-slate-500"> — {edu.institution}</span>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    {t('upload.results.education')} {t('common.noData')}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Actions after preview */}
      {step === 'preview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-end gap-3"
        >
          <Button
            variant="outline"
            onClick={() => {
              setStep('upload');
              setFile(null);
              setProfileData(null);
            }}
          >
            {t('upload.preview.reupload')}
          </Button>
          <Button
            onClick={() => {
              matchJobs.refetch();
              showToast('success', t('upload.done.subtitle'));
            }}
          >
            {t('upload.preview.confirm')}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
