import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useState } from 'react';
import { StatusBar } from "expo-status-bar";
import { router } from 'expo-router';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from '../firebaseConfig';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        setLoading(true);
        const auth = getAuth(app);
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Login successful", userCredential.user.uid);
            router.replace({
                pathname: '/home',
                params: {
                    userId: userCredential.user.uid,
                }
            });
        } catch (error) {
            console.error("Login error:", error);
            Alert.alert("Login Failed", getErrorMessage(error.code));
        } finally {
            setLoading(false);
        }
    }

    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/user-disabled':
                return 'This user has been disabled.';
            case 'auth/user-not-found':
                return 'No user found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            default:
                return 'An error occurred during login. Please try again.';
        }
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" hidden={true} />
            <View style={styles.innerContainer}>
                <View style={styles.header}>
                    <Text style={styles.headerText}>Pocket Planner</Text>
                </View>
                <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            placeholder="Email"
                            placeholderTextColor="#A3A3A3"
                            style={styles.input}
                            onChangeText={setEmail}
                            value={email}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="#A3A3A3"
                            style={styles.input}
                            onChangeText={setPassword}
                            value={password}
                            secureTextEntry={true}
                        />
                    </View>
                    <View style={styles.buttonContainer}>
                        <Pressable 
                            style={[styles.button, loading && styles.buttonDisabled]} 
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? 'Logging in...' : 'Login'}
                            </Text>
                        </Pressable>
                    </View>
                    <View style={styles.signUpContainer}>
                        <View style={styles.row}>
                            <Text>Don't have an account?</Text>
                            <Pressable onPress={() => router.replace("/signup")}>
                                <Text style={styles.signUpText}>Sign up</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#2E2E2E",
    height: "100%",
    width: "100%",
  },
  innerContainer: {
    height: "100%",
    width: "100%",
    justifyContent: "flex-start",
    paddingTop: 20,
    paddingBottom: 15,
  },
  header: {
    alignItems: "center",
    marginTop: 120,
  },
  headerText: {
    color: "#C8B08C",
    fontWeight: "bold",
    letterSpacing: 3,
    fontSize: 45,
  },
  inputContainer: {
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 40,
  },
  inputWrapper: {
    backgroundColor: "#3B3B3B",
    padding: 16,
    borderRadius: 20,
    width: "100%",
    marginBottom: 20,
    borderColor: "#5B5B5B",
    borderWidth: 1,
  },
  input: {
    color: "#E1E1E1",
  },
  buttonContainer: {
    width: "100%",
    marginTop: 10,
  },
  button: {
    width: "100%",
    backgroundColor: "#4A6E52",
    padding: 12,
    borderRadius: 20,
    marginTop: 25,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  signUpContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    color: "#4A6E52",
    marginLeft: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
