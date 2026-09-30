import { PASSWORD_MIN, validateRegistration } from '@champion/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { changePassword, deleteAccount, login, logout, register, resetPassword, sendResetCode, useUser } from '@/game/user';
import { refreshWallet } from '@/game/wallet';

type Mode = 'view' | 'register' | 'login' | 'password' | 'delete' | 'deleted' | 'forgot';

function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Txt v="capUpper" color={C.textMuted}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={C.textDim}
        autoCorrect={false}
        accessibilityLabel={label}
        style={[styles.input, !!error && styles.inputError]}
        {...input}
      />
      {error ? (
        <Txt v="cap" color={C.red}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** Account: register the guest account with email + password, log in, change password, log out. */
export function AccountCard() {
  const user = useUser();
  const registered = !!user?.email;
  const [mode, setMode] = useState<Mode>('view');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', newPassword: '', code: '' });
  // Forgotten password: 'email' → code sent → 'code'; or the backup code instead of an emailed one.
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');
  const [useBackup, setUseBackup] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const open = (m: Mode) => {
    setMode(m);
    setErrors({});
    setMessage(null);
    setForm((f) => ({ ...f, password: '', newPassword: '', username: f.username || user?.username || '' }));
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'register') {
        const local = validateRegistration(form) as Record<string, string>;
        if (Object.keys(local).length) return setErrors(local);
        const r = await register(form);
        if (!r.ok) return (setErrors(r.errors ?? {}), setMessage(r.error ?? null));
      } else if (mode === 'login') {
        const r = await login(form.email, form.password);
        if (!r.ok) return setMessage(r.error ?? 'Could not log in');
      } else if (mode === 'password') {
        if (form.newPassword.length < PASSWORD_MIN) return setErrors({ newPassword: `At least ${PASSWORD_MIN} characters` });
        const r = await changePassword(form.password, form.newPassword);
        if (!r.ok) return setMessage(r.error ?? 'Could not change the password');
        setMessage('Password changed.');
      }
      setMode('view');
      setErrors({});
      await refreshWallet();
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      if (resetStep === 'email' && !useBackup) {
        if (!form.email.trim()) return setErrors({ email: 'Enter your email' });
        const r = await sendResetCode(form.email);
        if (!r.ok) return setMessage(r.error ?? 'Could not send the code');
        setResetStep('code');
        return;
      }
      if (form.newPassword.length < PASSWORD_MIN) return setErrors({ newPassword: `At least ${PASSWORD_MIN} characters` });
      const r = await resetPassword(
        form.email,
        useBackup ? { backupCode: form.code.trim() } : { code: form.code },
        form.newPassword,
      );
      if (!r.ok) return setMessage(r.error ?? 'Could not set the password');
      setMode('view');
      setMessage('New password set – you are logged in.');
      await refreshWallet();
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'forgot') {
    const askCode = resetStep === 'code' || useBackup;
    return (
      <View style={styles.card}>
        <Txt v="h16">Forgot your password?</Txt>
        <Txt v="cap" color={C.textMuted}>
          {useBackup
            ? 'Enter your email, the backup code you saved from Profile, and a new password.'
            : resetStep === 'email'
              ? "We'll email you a 6-digit code (valid for 15 minutes)."
              : `If ${form.email.trim()} has an account, a code is on its way. Enter it with a new password.`}
        </Txt>
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!askCode || useBackup}
          error={errors.email}
        />
        {askCode && (
          <>
            <Field
              label={useBackup ? 'Backup code' : 'Code from the email'}
              value={form.code}
              onChangeText={set('code')}
              autoCapitalize="none"
              keyboardType={useBackup ? 'default' : 'number-pad'}
              maxLength={useBackup ? 64 : 6}
            />
            <Field
              label="New password"
              value={form.newPassword}
              onChangeText={set('newPassword')}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              error={errors.newPassword}
            />
          </>
        )}
        {message && (
          <Txt v="cap" color={C.red}>
            {message}
          </Txt>
        )}
        <View style={styles.row}>
          <Btn kind="dark" label="CANCEL" height={44} labelType="capUpper" onPress={() => setMode('login')} style={styles.flex} />
          <Btn
            kind="blue"
            label={busy ? '…' : askCode ? 'SET PASSWORD' : 'SEND CODE'}
            height={44}
            labelType="capUpper"
            disabled={busy}
            onPress={forgot}
            style={styles.flex}
          />
        </View>
        <Pressable
          onPress={() => {
            setUseBackup((b) => !b);
            setMessage(null);
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.deleteLink}>
          <Txt v="cap" color={C.blueLight}>
            {useBackup ? 'Get a code by email instead' : 'Use my backup code instead'}
          </Txt>
        </Pressable>
      </View>
    );
  }

  const confirmDelete = async () => {
    setBusy(true);
    setMessage(null);
    const r = await deleteAccount(registered ? form.password : undefined);
    setBusy(false);
    if (!r.ok) return setMessage(r.error ?? 'Could not delete the account');
    setMode('deleted');
  };

  if (mode === 'deleted') {
    return (
      <View style={styles.card}>
        <Txt v="h16">Account deleted</Txt>
        <Txt v="body" color={C.textMuted}>
          Your account and everything tied to it are gone: coins, saved squads, scores and mini-league places. Close
          and reopen the app to start over with a fresh guest account.
        </Txt>
      </View>
    );
  }

  if (mode === 'delete') {
    return (
      <View style={[styles.card, styles.danger]}>
        <Txt v="h16">Delete your account?</Txt>
        <Txt v="body" color={C.textMuted}>
          This permanently deletes @{user?.username} and everything tied to it: your coins and anything bought with
          them, saved squads on the leaderboard, Daily scores, mini-league places, and the game data on this device.
          It can&apos;t be undone.
        </Txt>
        {registered && (
          <Field
            label="Password"
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
        )}
        {message && (
          <Txt v="cap" color={C.red}>
            {message}
          </Txt>
        )}
        <View style={styles.row}>
          <Btn kind="dark" label="KEEP MY ACCOUNT" height={44} labelType="capUpper" onPress={() => setMode('view')} style={styles.flex} />
          <Btn
            kind="mid"
            label={busy ? '…' : 'DELETE FOREVER'}
            height={44}
            labelType="capUpper"
            disabled={busy || (registered && !form.password)}
            onPress={confirmDelete}
            style={styles.flex}
          />
        </View>
      </View>
    );
  }

  if (mode === 'view') {
    return (
      <View style={styles.card}>
        {registered ? (
          <>
            <Txt v="h16">{user?.name}</Txt>
            <Txt v="body" color={C.textMuted}>
              @{user?.username} · {user?.email}
            </Txt>
            {message && (
              <Txt v="cap" color={C.green}>
                {message}
              </Txt>
            )}
            <View style={styles.row}>
              <Btn kind="dark" label="CHANGE PASSWORD" height={40} labelType="capUpper" onPress={() => open('password')} style={styles.flex} />
              <Btn
                kind="dark"
                label="LOG OUT"
                height={40}
                labelType="capUpper"
                onPress={() => {
                  logout();
                  void refreshWallet();
                }}
                style={styles.flex}
              />
            </View>
          </>
        ) : (
          <>
            <Txt v="body" color={C.textMuted}>
              You play as a guest{user ? ` (@${user.username})` : ''}. Create an account to keep your coins and squads
              safe and to log in on other devices.
            </Txt>
            <View style={styles.row}>
              <Btn kind="blue" label="CREATE ACCOUNT" height={44} labelType="capUpper" onPress={() => open('register')} style={styles.flex} />
              <Btn kind="dark" label="LOG IN" height={44} labelType="capUpper" onPress={() => open('login')} style={styles.flex} />
            </View>
          </>
        )}
        {user && (
          <Pressable
            onPress={() => open('delete')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.6 }]}>
            <Txt v="cap" color={C.red}>
              Delete account
            </Txt>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Txt v="h16">{mode === 'register' ? 'Create account' : mode === 'login' ? 'Log in' : 'Change password'}</Txt>
      {mode === 'register' && (
        <>
          <Txt v="cap" color={C.textMuted}>
            Your guest account (coins, saved squads) becomes this account.
          </Txt>
          <Field label="Name" value={form.name} onChangeText={set('name')} autoComplete="name" error={errors.name} />
          <Field
            label="Username"
            value={form.username}
            onChangeText={set('username')}
            autoCapitalize="none"
            autoComplete="username"
            maxLength={20}
            error={errors.username}
          />
        </>
      )}
      {mode !== 'password' && (
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
        />
      )}
      <Field
        label={mode === 'password' ? 'Current password' : 'Password'}
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        error={errors.password}
      />
      {mode === 'password' && (
        <Field
          label="New password"
          value={form.newPassword}
          onChangeText={set('newPassword')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          error={errors.newPassword}
        />
      )}
      {mode === 'login' && (
        <>
          <Txt v="cap" color={C.textMuted}>
            This device switches to that account. Coins of the current guest account stay with the guest account.
          </Txt>
          <Pressable
            onPress={() => {
              setMode('forgot');
              setResetStep('email');
              setUseBackup(false);
              setMessage(null);
              setErrors({});
              setForm((f) => ({ ...f, code: '', newPassword: '' }));
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignSelf: 'flex-start' }}>
            <Txt v="cap" color={C.blueLight}>
              Forgot password?
            </Txt>
          </Pressable>
        </>
      )}
      {message && (
        <Txt v="cap" color={C.red}>
          {message}
        </Txt>
      )}
      <View style={styles.row}>
        <Btn kind="dark" label="CANCEL" height={44} labelType="capUpper" onPress={() => setMode('view')} style={styles.flex} />
        <Btn
          kind="blue"
          label={busy ? '…' : mode === 'register' ? 'CREATE' : mode === 'login' ? 'LOG IN' : 'SAVE'}
          height={44}
          labelType="capUpper"
          disabled={busy}
          onPress={submit}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: R.xl, backgroundColor: C.surface },
  row: { flexDirection: 'row', gap: 8 },
  danger: { borderWidth: 1, borderColor: alpha(C.red, 0.4) },
  deleteLink: { alignSelf: 'center', paddingTop: 4 },
  flex: { flex: 1 },
  field: { gap: 4 },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: R.md,
    backgroundColor: C.surface3,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: { borderColor: C.red },
});
