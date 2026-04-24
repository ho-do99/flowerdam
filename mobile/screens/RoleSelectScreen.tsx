import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const ROLES = [
  { id: 'customer', name: '소비자', icon: '👤', description: '화환 주문' },
  { id: 'seller', name: '셀러', icon: '🎁', description: '추천으로 수익' },
  { id: 'partner_owner', name: '가맹점 사장', icon: '🏪', description: '가맹점 운영' },
  { id: 'partner_staff', name: '가맹점 직원', icon: '👨‍💼', description: '주문 처리' },
];

export default function RoleSelectScreen({ navigation }: any) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleNext = () => {
    if (selectedRole) {
      navigation.navigate('Register', { role: selectedRole });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← 뒤로</Text>
      </TouchableOpacity>

      <Text style={styles.title}>역할을 선택하세요</Text>

      <View style={styles.rolesContainer}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.roleCard,
              selectedRole === role.id && styles.roleCardSelected,
            ]}
            onPress={() => setSelectedRole(role.id)}
          >
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <Text style={styles.roleName}>{role.name}</Text>
            <Text style={styles.roleDescription}>{role.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, !selectedRole && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!selectedRole}
      >
        <Text style={styles.buttonText}>다음</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  backButton: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  rolesContainer: {
    gap: 12,
    marginBottom: 30,
  },
  roleCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EEE',
    alignItems: 'center',
  },
  roleCardSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  roleIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  roleName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 12,
    color: '#999',
  },
  button: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
