import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Animated } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { ArrowBigLeftDash, Plus, AlertCircle, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { ref, push, serverTimestamp, get, update } from 'firebase/database';
import app, { database } from '../firebaseConfig';

const UIAlert = ({ type, message, visible, onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (type === 'success') {
        const timer = setTimeout(() => {
          handleDismiss();
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  if (!visible) return null;

  const backgroundColor = type === 'error' ? '#FF6B6B' : '#4A6E52';
  const Icon = type === 'error' ? AlertCircle : Check;

  return (
    <Animated.View
      style={[
        styles.alertContainer,
        {
          backgroundColor,
          transform: [{ translateY: slideAnim }],
          opacity,
        },
      ]}
    >
      <Icon color="white" size={24} />
      <Text style={styles.alertText}>{message}</Text>
      <Pressable onPress={handleDismiss} style={styles.alertDismiss}>
        <Text style={styles.alertDismissText}>✕</Text>
      </Pressable>
    </Animated.View>
  );
};

export default function AddExpense() {
  const [expense, setExpense] = useState({
    amount: '',
    category: '',
    description: '',
  });
  const [currentBudget, setCurrentBudget] = useState(null);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ visible: false, type: '', message: '' });

  const auth = getAuth(app);
  const user = auth.currentUser;

  useEffect(() => {
    fetchCurrentBudget();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    if (!user?.uid) return;

    try {
      const categoriesRef = ref(database, `users/${user.uid}/categories`);
      const snapshot = await get(categoriesRef);
      if (snapshot.exists()) {
        setCategories(snapshot.val());
      }
    } catch (error) {
      showAlert('error', 'Error fetching categories');
    }
  };

  const fetchCurrentBudget = async () => {
    if (!user?.uid) {
      showAlert('error', 'User not authenticated');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7);
      const budgetRef = ref(database, `users/${user.uid}/budget/${monthStart}`);
      
      const budgetSnapshot = await get(budgetRef);
      const budgetData = budgetSnapshot.val() || {
        totalBudget: 0,
        spent: 0,
        categories: {}
      };
      
      setCurrentBudget(budgetData);
    } catch (error) {
      showAlert('error', 'Error fetching budget data');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ visible: true, type, message });
  };

  const handleSaveExpense = async () => {
    if (!user?.uid) {
      showAlert('error', 'User not authenticated');
      return;
    }

    const amount = parseFloat(expense.amount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('error', 'Please enter a valid amount');
      return;
    }

    if (!expense.category) {
      showAlert('error', 'Please select a category');
      return;
    }

    const remainingBudget = currentBudget.totalBudget - currentBudget.spent;
    if (amount > remainingBudget) {
      showAlert('error', `This expense exceeds your remaining budget by $${(amount - remainingBudget).toFixed(2)}`);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7);
      
      // Create new expense data
      const newExpenseRef = push(ref(database, `users/${user.uid}/expenses`));
      const expenseData = {
        amount,
        category: expense.category,
        description: expense.description,
        timestamp: serverTimestamp(),
      };

      // Update budget data
      const updatedBudget = {
        ...currentBudget,
        spent: (currentBudget.spent || 0) + amount,
        categories: {
          ...(currentBudget.categories || {}),
          [expense.category]: ((currentBudget.categories || {})[expense.category] || 0) + amount
        }
      };

      // Create update object following the security rules structure
      const updates = {};
      updates[`users/${user.uid}/budget/${monthStart}`] = updatedBudget;
      updates[`users/${user.uid}/expenses/${newExpenseRef.key}`] = expenseData;

      // Perform the update
      await update(ref(database), updates);
      
      showAlert('success', 'Expense saved successfully!');
      
      setTimeout(() => {
        router.replace("/home");
      }, 1000);
    } catch (error) {
      console.error('Error saving expense:', error);
      showAlert('error', 'Failed to save expense. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading budget information...</Text>
      </View>
    );
  }

  const remainingBudget = currentBudget ? currentBudget.totalBudget - currentBudget.spent : 0;

  return (
    <View style={styles.container}>
      <UIAlert
        type={alert.type}
        message={alert.message}
        visible={alert.visible}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />
      
      <Pressable style={styles.backButton} onPress={() => router.replace("/home")}>
        <ArrowBigLeftDash color="#C8B08C" />
      </Pressable>
      
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.title}>Add Expense</Text>
        
        <View style={styles.budgetInfo}>
          <Text style={styles.budgetText}>
            Remaining Budget: ${remainingBudget.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.formContainer}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            placeholderTextColor="#A3A3A3"
            keyboardType="numeric"
            value={expense.amount}
            onChangeText={(text) => setExpense({ ...expense, amount: text })}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryContainer}>
            {Object.entries(categories).map(([key, category]) => (
              <Pressable
                key={key}
                style={[
                  styles.categoryButton,
                  expense.category === key && styles.categoryButtonSelected,
                  { backgroundColor: category.color + '40' },
                ]}
                onPress={() => setExpense({ ...expense, category: key })}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryText}>{category.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Enter description"
            placeholderTextColor="#A3A3A3"
            multiline
            value={expense.description}
            onChangeText={(text) => setExpense({ ...expense, description: text })}
          />

          <Pressable style={styles.saveButton} onPress={handleSaveExpense}>
            <Plus size={24} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Add Expense</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E2E2E',
  },
  scrollContainer: {
    padding: 20,
  },
  backButton: {
    padding: 15,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#C8B08C',
    marginBottom: 20,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C8B08C',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#2E2E2E',
    borderRadius: 10,
    padding: 15,
    color: '#E1E1E1',
    marginBottom: 20,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryButton: {
    width: '48%',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryButtonSelected: {
    borderWidth: 2,
    borderColor: '#C8B08C',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  categoryText: {
    color: '#E1E1E1',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4A6E52',
    flexDirection: 'row',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#E1E1E1',
    fontSize: 18,
  },
  budgetInfo: {
    backgroundColor: '#3B3B3B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  budgetText: {
    color: '#4A6E52',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  alertContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
  },
  alertText: {
    color: 'white',
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
  },
  alertDismiss: {
    padding: 5,
  },
  alertDismissText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});