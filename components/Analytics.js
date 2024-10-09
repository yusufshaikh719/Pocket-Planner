import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import React, { useState, useEffect } from 'react';
import { ArrowBigLeftDash } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';
import { LineChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';

export default function Analytics() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({});
  const [timeFrame, setTimeFrame] = useState('month');
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) return;

    const categoriesRef = ref(database, `users/${user.uid}/categories`);
    const unsubscribeCategories = onValue(categoriesRef, (snapshot) => {
      if (snapshot.exists()) {
        setCategories(snapshot.val());
      }
    });

    const expensesRef = ref(database, `users/${user.uid}/expenses`);
    const unsubscribeExpenses = onValue(expensesRef, (snapshot) => {
      if (snapshot.exists()) {
        const expensesData = snapshot.val();
        const expensesArray = Object.entries(expensesData).map(([id, data]) => ({
          id,
          ...data,
          date: new Date(data.timestamp).toISOString().split('T')[0],
        }));
        setExpenses(expensesArray);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeCategories();
      unsubscribeExpenses();
    };
  }, [user?.uid]);

  const getTimeFrameExpenses = () => {
    const now = new Date();
    const timeFrameStart = new Date();
    
    switch (timeFrame) {
      case 'week':
        timeFrameStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        timeFrameStart.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        timeFrameStart.setFullYear(now.getFullYear() - 1);
        break;
    }

    return expenses.filter(expense => new Date(expense.timestamp) >= timeFrameStart);
  };

  const prepareChartData = () => {
    const timeFrameExpenses = getTimeFrameExpenses();
    const dateMap = new Map();

    timeFrameExpenses.forEach(expense => {
      const date = new Date(expense.timestamp).toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          total: 0,
          ...Object.keys(categories).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {}),
        });
      }
      const dateData = dateMap.get(date);
      dateData[expense.category] = (dateData[expense.category] || 0) + expense.amount;
      dateData.total += expense.amount;
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const calculateTotalByCategory = () => {
    const timeFrameExpenses = getTimeFrameExpenses();
    return timeFrameExpenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowBigLeftDash color="#C8B08C" size={24} />
        </Pressable>
        <Text style={styles.headerText}>Expense Analytics</Text>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>Spending Over Time</Text>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={prepareChartData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <XAxis dataKey="date" stroke="#E1E1E1" />
            <YAxis stroke="#E1E1E1" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#2E2E2E', border: 'none' }}
              labelStyle={{ color: '#E1E1E1' }}
              itemStyle={{ color: '#E1E1E1' }}
            />
            <Legend />
            {Object.entries(categories).map(([key, category]) => (
              <Line 
                key={key}
                type="monotone"
                dataKey={key}
                stroke={category.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </View>

      <View style={styles.categoryContainer}>
        <Text style={styles.sectionTitle}>Category Breakdown</Text>
        {Object.entries(categories).map(([key, category]) => {
          const amount = calculateTotalByCategory()[key] || 0;
          const totalExpenses = getTimeFrameExpenses().reduce((acc, exp) => acc + exp.amount, 0) || 1;
          const percentage = (amount / totalExpenses) * 100;

          return (
            <View key={key} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryNameContainer}>
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
                <Text style={styles.categoryAmount}>${amount.toFixed(2)}</Text>
              </View>
              <View style={styles.barContainer}>
                <View 
                  style={[
                    styles.bar,
                    { backgroundColor: category.color, width: `${percentage}%` }
                  ]} 
                />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E2E2E',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2E2E2E',
  },
  loadingText: {
    color: '#E1E1E1',
    fontSize: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerText: {
    color: '#C8B08C',
    fontSize: 24,
    fontWeight: 'bold',
  },
  timeFrameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeFrameButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#3B3B3B',
  },
  timeFrameButtonSelected: {
    backgroundColor: '#4A6E52',
  },
  timeFrameButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timeFrameButtonTextSelected: {
    fontWeight: 'bold',
  },
  chartContainer: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 16,
    marginBottom: 24,
  },
  categoryContainer: {
    backgroundColor: '#3B3B3B',
    borderRadius: 15,
    padding: 16,
  },
  sectionTitle: {
    color: '#C8B08C',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryName: {
    color: '#E1E1E1',
    fontSize: 18,
  },
  categoryAmount: {
    color: '#C8B08C',
    fontSize: 18,
  },
  barContainer: {
    height: 8,
    backgroundColor: '#2E2E2E',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
});