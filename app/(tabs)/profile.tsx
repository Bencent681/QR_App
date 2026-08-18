import { StyleSheet, Text, View, Pressable, Image } from 'react-native';
import { COLORS } from '@/constants/colors';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>

      {/* Profile Header */}
      <View style={styles.profileHeader}>

        <Image
          source={require('@/assets/images/profile.jpg')}
          style={styles.profileImage}
        />

        <Text style={styles.name}>Bencent Sabulleros</Text>
        <Text style={styles.email}>bencesab05@gmail.com</Text>
      </View>

      {/* Personal Information */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>09925310020</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>Pinamungajan</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Birthday</Text>
          <Text style={styles.value}>November 16, 1999</Text>
        </View>
      </View>

      {/* Edit Profile Button */}
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Edit Profile</Text>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 30,
  },

  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },

  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: '#00E5FF',
  },

  name: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  email: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#00E5FF',
    borderRadius: 16,
    padding: 20,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 18,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },

  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.textSecondary,
    opacity: 0.2,
  },

  button: {
    marginTop: 25,
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#050816',
  },
});