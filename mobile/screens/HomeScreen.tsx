import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }: any) {
  const [userRole] = useState('customer');

  const handleLogout = async () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠습니까?', [
      { text: '취소' },
      {
        text: '확인',
        onPress: async () => {
          await AsyncStorage.removeItem('accessToken');
          await AsyncStorage.removeItem('refreshToken');
          // App.tsx로 돌아가서 AuthNavigator 표시
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🌸 FlowerDam</Text>
        <Text style={styles.subtitle}>소비자</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>주문</Text>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardIcon}>🎁</Text>
          <Text style={styles.cardTitle}>새 주문</Text>
          <Text style={styles.cardSubtitle}>화환 주문하기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardIcon}>📋</Text>
          <Text style={styles.cardTitle}>주문 내역</Text>
          <Text style={styles.cardSubtitle}>주문 현황 확인</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>설정</Text>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardIcon}>👤</Text>
          <Text style={styles.cardTitle}>프로필</Text>
          <Text style={styles.cardSubtitle}>프로필 관리</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={handleLogout}>
          <Text style={styles.cardIcon}>🚪</Text>
          <Text style={styles.cardTitle}>로그아웃</Text>
          <Text style={styles.cardSubtitle}>로그아웃하기</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F5',
  },
  header: {
    backgroundColor: '#FF6B6B',
    padding: 30,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: '#FFE5E5',
    marginTop: 8,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#999',
  },
});
