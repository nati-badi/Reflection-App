import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Theme } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Eye, EyeOff } from 'lucide-react-native';

// Map raw Firebase error codes to user-friendly messages
const mapAuthError = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  
  const { theme } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleTextChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (val: string) => {
    setter(val);
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const validateInputs = () => {
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!isLogin) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return false;
      }
    }
    return true;
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !confirmPassword)) return;
    
    if (!validateInputs()) return;

    setLoading(true);
    setError('');
    
    const trimmedEmail = email.trim();
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        try {
          await sendEmailVerification(userCred.user);
          setSuccessMessage(`We sent a verification link to ${trimmedEmail}. Please check your inbox.`);
        } catch (vErr) {
          console.warn('sendEmailVerification failed:', vErr);
        }
      }
    } catch (err: any) {
      setError(mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email to reset password.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage('Check your email for a reset link.');
    } catch (err: any) {
      // Firebase best practice is to always show success even if the email doesn't exist
      // but we will map explicitly known format errors just in case.
      if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setSuccessMessage('Check your email for a reset link.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email.trim().length > 0 && password.length > 0 && (isLogin || confirmPassword.length > 0);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Web Autofill CSS Override */}
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{ __html: `
          input:-webkit-autofill,
          input:-webkit-autofill:hover, 
          input:-webkit-autofill:focus, 
          input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0px 1000px ${theme.colors.surface} inset !important;
            -webkit-text-fill-color: ${theme.colors.textPrimary} !important;
            transition: background-color 5000s ease-in-out 0s;
          }
        `}} />
      )}

      <View style={styles.formContainer}>
        <Text style={styles.title}>Daily Reflection</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Welcome back' : 'Create your account'}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.colors.textSecondary}
          value={email}
          onChangeText={handleTextChange(setEmail)}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            ref={passwordRef}
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={theme.colors.textSecondary}
            value={password}
            onChangeText={handleTextChange(setPassword)}
            secureTextEntry={!showPassword}
            textContentType={isLogin ? 'password' : 'newPassword'}
            autoComplete={isLogin ? 'password' : 'new-password'}
            returnKeyType={isLogin ? 'done' : 'next'}
            onSubmitEditing={() => isLogin ? handleAuth() : confirmPasswordRef.current?.focus()}
          />
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff size={20} color={theme.colors.textSecondary} />
            ) : (
              <Eye size={20} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {!isLogin && (
          <View style={styles.passwordContainer}>
            <TextInput
              ref={confirmPasswordRef}
              style={[styles.input, styles.passwordInput]}
              placeholder="Confirm Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={confirmPassword}
              onChangeText={handleTextChange(setConfirmPassword)}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleAuth}
            />
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, (!isFormValid || loading) && { opacity: 0.6 }]}
          onPress={handleAuth}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.accentForeground} />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
          )}
        </TouchableOpacity>

        {isLogin && (
          <TouchableOpacity 
            style={styles.forgotPasswordButton}
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={() => {
            setIsLogin(!isLogin);
            setError('');
            setSuccessMessage('');
          }}
          disabled={loading}
        >
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.h1,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.sizes.regular,
    color: theme.colors.textPrimary,
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
    paddingBottom: theme.spacing.md, // align with input's marginBottom
  },
  button: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  buttonText: {
    color: theme.colors.accentForeground,
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
  },
  forgotPasswordButton: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: theme.colors.accent,
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.medium,
  },
  toggleButton: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  toggleText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  successText: {
    color: '#10B981',
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.medium,
  }
});
