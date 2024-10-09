import { View, Text, StyleSheet, ScrollView, Pressable, TouchableWithoutFeedback, TextInput, Modal, Animated } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Wallet, PieChart, User, LogOut, Plus, Edit2, Trash2, AlertCircle, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { ref, onValue, set, update } from 'firebase/database';
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

// Move EXPENSE_CATEGORIES to state since it will be dynamic now
const DEFAULT_CATEGORIES = {
  groceries: { name: 'Groceries', icon: '🛒', color: '#4A6E52' },
  rent: { name: 'Rent', icon: '🏠', color: '#C8B08C' },
  utilities: { name: 'Utilities', icon: '💡', color: '#FF6B6B' },
  entertainment: { name: 'Entertainment', icon: '🎬', color: '#6B66FF' },
  transportation: { name: 'Transportation', icon: '🚌', color: '#66D7D1' },
  education: { name: 'Education', icon: '📚', color: '#FF66D7' },
};

export default function Home() {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [expenseCategories, setExpenseCategories] = useState({});
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [alert, setAlert] = useState({ visible: false, type: '', message: '' });

  useEffect(() => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7);
    const budgetRef = ref(database, `users/${user.uid}/budget/${monthStart}`);
    const categoriesRef = ref(database, `users/${user.uid}/categories`);
    
    const unsubscribeBudget = onValue(budgetRef, (snapshot) => {
      const data = snapshot.val();
      setBudget(data || {
        totalBudget: 0,
        spent: 0,
        categories: {}
      });
      setTempBudget((data?.totalBudget || 0).toString());
    });

    const unsubscribeCategories = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setExpenseCategories(data);
      } else {
        // Initialize with default categories if none exist
        set(categoriesRef, DEFAULT_CATEGORIES);
        setExpenseCategories(DEFAULT_CATEGORIES);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeBudget();
      unsubscribeCategories();
    };
  }, []);

  const showAlert = (type, message) => {
    setAlert({ visible: true, type, message });
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;

    const categoryKey = newCategoryName.toLowerCase().replace(/\s+/g, '_');
    const newCategory = {
      name: newCategoryName,
      icon: newCategoryIcon || '📦', // Default icon if none provided
      color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color
    };

    try {
      const updates = {};
      updates[`users/${user.uid}/categories/${categoryKey}`] = newCategory;
      
      // Also update the current month's budget to include the new category
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7);
      updates[`users/${user.uid}/budget/${monthStart}/categories/${categoryKey}`] = 0;

      await update(ref(database), updates);
      
      setNewCategoryName('');
      setNewCategoryIcon('');
      setShowAddCategory(false);
    } catch (error) {
      console.error('Error adding category:', error);
      Alert.alert('Error', 'Failed to add category. Please try again.');
    }
  };

  const handleDeleteCategory = async (categoryKey) => {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) {
      showAlert('error', 'User not authenticated');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7);
      
      // Create updates object
      const updates = {};
      updates[`users/${user.uid}/categories/${categoryKey}`] = null;
      updates[`users/${user.uid}/budget/${monthStart}/categories/${categoryKey}`] = null;

      // Perform the update
      await update(ref(database), updates);
      
      // Update local state to reflect the deletion
      const updatedCategories = { ...expenseCategories };
      delete updatedCategories[categoryKey];
      setExpenseCategories(updatedCategories);

      const updatedBudget = { ...budget };
      if (updatedBudget.categories) {
        delete updatedBudget.categories[categoryKey];
        setBudget(updatedBudget);
      }
      
      showAlert('success', 'Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      showAlert('error', 'Failed to delete category. Please try again.');
    }
  };

  const handleBudgetUpdate = async () => {
    const newBudget = parseFloat(tempBudget);
    if (isNaN(newBudget) || newBudget < 0) {
      Alert.alert('Invalid Budget', 'Please enter a valid number for your budget.');
      return;
    }

    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7);
    const budgetRef = ref(database, `users/${user.uid}/budget/${monthStart}`);

    try {
      const updatedBudget = {
        ...budget,
        totalBudget: newBudget
      };
      await set(budgetRef, updatedBudget);
      setBudget(updatedBudget);
      setEditingBudget(false);
    } catch (error) {
      console.error('Error updating budget:', error);
      Alert.alert('Error', 'Failed to update budget. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getAuth();
      await auth.signOut();
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const renderBar = (value, total, width) => {
    const percentage = Math.min((value / total) * 100, 100);
    return (
      <View style={styles.barContainer}>
        <View style={[styles.bar, { width: `${percentage}%` }]} />
        <View style={[styles.goalBar, { width: `${width}%` }]} />
      </View>
    );
  };

  const remainingBudget = budget ? budget.totalBudget - budget.spent : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <UIAlert
        type={alert.type}
        message={alert.message}
        visible={alert.visible}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />
      <ScrollView style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>Student Budget</Text>
          <Pressable 
            style={styles.profileIcon}
            onPress={() => setShowDropdown(!showDropdown)}
          >
            <User color="#C8B08C" size={24} />
          </Pressable>
        </View>

        <View style={styles.budgetOverview}>
          <View style={styles.budgetHeaderRow}>
            <Text style={styles.budgetTitle}>Monthly Budget</Text>
            <Pressable 
              style={styles.editButton}
              onPress={() => setEditingBudget(!editingBudget)}
            >
              <Edit2 color="#C8B08C" size={20} />
            </Pressable>
          </View>
          
          {editingBudget ? (
            <View style={styles.budgetEditContainer}>
              <TextInput
                style={styles.budgetInput}
                value={tempBudget}
                onChangeText={setTempBudget}
                keyboardType="numeric"
                placeholder="Enter budget amount"
                placeholderTextColor="#999"
              />
              <Pressable 
                style={styles.saveButton}
                onPress={handleBudgetUpdate}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.budgetAmount}>
                ${remainingBudget.toFixed(2)} remaining
              </Text>
              <View style={styles.budgetBar}>
                {renderBar(budget?.spent || 0, budget?.totalBudget || 1, 100)}
              </View>
              <Text style={styles.budgetSubtext}>
                ${budget?.spent.toFixed(2)} spent of ${budget?.totalBudget.toFixed(2)}
              </Text>
            </>
          )}
        </View>

        <View style={styles.categorySection}>
          <View style={styles.categoryHeaderContainer}>
            <Text style={styles.sectionTitle}>Spending by Category</Text>
            <Pressable 
              style={styles.addCategoryButton}
              onPress={() => setShowAddCategory(true)}
            >
              <Plus color="#C8B08C" size={24} />
            </Pressable>
          </View>
          
          {Object.entries(expenseCategories).map(([key, category]) => (
            <View key={key} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryAmount}>
                  ${budget?.categories?.[key]?.toFixed(2) || '0.00'}
                </Text>
                <Pressable 
                  style={styles.deleteCategoryButton}
                  onPress={() => handleDeleteCategory(key)}
                >
                  <Trash2 color="#FF6B6B" size={20} />
                </Pressable>
              </View>
              <View style={styles.categoryBar}>
                {renderBar(
                  budget?.categories?.[key] || 0,
                  budget?.totalBudget || 1,
                  100
                )}
              </View>
            </View>
          ))}
        </View>

        <Pressable 
          style={styles.addButton}
          onPress={() => router.push("/addexpense")}
        >
          <Plus size={24} color="#FFFFFF" />
          <Text style={styles.buttonText}>Add Expense</Text>
        </Pressable>

        <Pressable 
          style={styles.planningButton}
          onPress={() => router.push("/analytics")}
        >
          <PieChart size={24} color="#FFFFFF" />
          <Text style={styles.buttonText}>View Analytics</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showAddCategory}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category Name"
              placeholderTextColor="#999"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Category Icon (emoji)"
              placeholderTextColor="#999"
              value={newCategoryIcon}
              onChangeText={setNewCategoryIcon}
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddCategory(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddCategory}
              >
                <Text style={styles.modalButtonText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {showDropdown && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
            <View style={styles.dropdownOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.dropdownContainer}>
                  <Pressable 
                    style={[styles.dropdownItem, styles.lastDropdownItem]}
                    onPress={handleSignOut}
                  >
                    <LogOut size={20} color="#FF6B6B" />
                    <Text style={[styles.dropdownText, { color: '#FF6B6B' }]}>Sign Out</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#2E2E2E',
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    headerText: {
        color: '#C8B08C',
        fontSize: 28,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    budgetOverview: {
        backgroundColor: '#3B3B3B',
        margin: 20,
        padding: 20,
        borderRadius: 15,
    },
    budgetHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    budgetTitle: {
        color: '#C8B08C',
        fontSize: 22,
        fontWeight: 'bold',
    },
    editButton: {
        padding: 5,
    },
    budgetEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    budgetInput: {
        flex: 1,
        backgroundColor: '#2E2E2E',
        color: '#E1E1E1',
        padding: 10,
        borderRadius: 8,
        marginRight: 10,
        fontSize: 18,
    },
    saveButton: {
        backgroundColor: '#4A6E52',
        padding: 10,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    budgetAmount: {
        color: '#4A6E52',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    budgetBar: {
        marginBottom: 5,
    },
    budgetSubtext: {
        color: '#E1E1E1',
        fontSize: 14,
    },
    budgetSubtext: {
        color: '#E1E1E1',
        fontSize: 14,
    },
    categorySection: {
        margin: 20,
    },
    categoryBar: {
        color: "#B31717",
    },
    sectionTitle: {
        color: '#C8B08C',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    categoryItem: {
        marginBottom: 15,
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    categoryIcon: {
        fontSize: 20,
        marginRight: 10,
    },
    categoryName: {
        color: '#E1E1E1',
        fontSize: 16,
        flex: 1,
    },
    categoryAmount: {
        color: '#C8B08C',
        fontSize: 16,
    },
    barContainer: {
        height: 10,
        backgroundColor: '#2E2E2E',
        borderRadius: 5,
        overflow: 'hidden',
    },
    bar: {
        position: 'absolute',
        height: '100%',
        backgroundColor: '#4A6E52',
    },
    goalBar: {
        position: 'absolute',
        height: '100%',
        backgroundColor: '#C8B08C',
        opacity: 0.3,
    },
    addButton: {
      flexDirection: 'row',
      backgroundColor: '#4A6E52',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 20,
      marginBottom: 15,
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    planningButton: {
      backgroundColor: '#C8B08C',
      flexDirection: 'row',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 20,
      marginBottom: 30,
    },
    planningButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    dropdownContainer: {
        position: 'absolute',
        top: 110,
        right: 20,
        backgroundColor: '#3B3B3B',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#5B5B5B',
        zIndex: 1000,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#5B5B5B',
    },
    dropdownText: {
        color: '#E1E1E1',
        marginLeft: 10,
        fontSize: 16,
    },
    lastDropdownItem: {
        borderBottomWidth: 0,
    },
    categoryHeaderContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
    },
    addCategoryButton: {
      padding: 8,
      backgroundColor: '#3B3B3B',
      borderRadius: 8,
    },
    deleteCategoryButton: {
      padding: 8,
      marginLeft: 10,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: '#3B3B3B',
      borderRadius: 15,
      padding: 20,
      width: '80%',
    },
    modalTitle: {
      color: '#C8B08C',
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 15,
    },
    modalInput: {
      backgroundColor: '#2E2E2E',
      color: '#E1E1E1',
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      fontSize: 16,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 15,
    },
    modalButton: {
      padding: 10,
      borderRadius: 8,
      marginLeft: 10,
    },
    cancelButton: {
      backgroundColor: '#FF6B6B',
    },
    addButton: {
      backgroundColor: '#4A6E52',
      flexDirection: 'row',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 20,
      marginBottom: 15,
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
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