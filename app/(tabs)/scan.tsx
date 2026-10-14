import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';

import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { user } = useAuth();

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Text style={styles.permissionIconText}>▣</Text>
        </View>

        <Text style={styles.title}>Camera Permission</Text>

        <Text style={styles.subtitle}>
          Camera access is required to scan attendance QR codes.
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Text style={styles.permissionIconText}>▣</Text>
        </View>

        <Text style={styles.title}>
          Camera Permission Needed
        </Text>

        <Text style={styles.subtitle}>
          Allow camera access so you can scan the QR code provided
          by your instructor.
        </Text>

        <View style={styles.permissionButton}>
          <AppButton
            theme="primary"
            title="Grant Permission"
            icon="camera"
            onPress={requestPermission}
          />
        </View>
      </View>
    );
  }

  const handleBarcodeScanned = ({
    data,
  }: {
    data: string;
  }) => {
    setScanned(true);
    setLastData(data);

    if (!user) {
      setMessage(
        'You must be logged in to record attendance.'
      );
      setSuccess(false);
      return;
    }

    registerAttendance(data, user.id).then((result) => {
      setMessage(result.message);
      setSuccess(result.success);
    });
  };

  const handleScanAgain = () => {
    setScanned(false);
    setLastData(null);
    setMessage(null);
    setSuccess(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned
            ? undefined
            : handleBarcodeScanned
        }
      />

      {/* Dark camera overlay */}
      <View style={styles.topOverlay}>
        <Text style={styles.headerTitle}>
          Scan Attendance
        </Text>

        <Text style={styles.headerSubtitle}>
          Scan the QR code provided by your instructor
        </Text>
      </View>

      {!scanned && (
        <>
          {/* Scanner frame */}
          <View style={styles.scannerArea}>
            <View style={styles.scannerFrame}>
              {/* Top Left */}
              <View style={[styles.corner, styles.topLeft]} />

              {/* Top Right */}
              <View style={[styles.corner, styles.topRight]} />

              {/* Bottom Left */}
              <View style={[styles.corner, styles.bottomLeft]} />

              {/* Bottom Right */}
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          <View style={styles.instructionContainer}>
            <Text style={styles.instructionTitle}>
              Align QR code within the frame
            </Text>

            <Text style={styles.instructionText}>
              The code will be scanned automatically.
            </Text>
          </View>
        </>
      )}

      {/* Scan Result */}
      {scanned && (
        <View style={styles.resultContainer}>
          <View
            style={[
              styles.resultIcon,
              success
                ? styles.resultIconSuccess
                : styles.resultIconError,
            ]}
          >
            <Text style={styles.resultIconText}>
              {success ? '✓' : '!'}
            </Text>
          </View>

          <Text style={styles.resultTitle}>
            {success
              ? 'Attendance Recorded'
              : 'Scan Unsuccessful'}
          </Text>

          {message && (
            <Text
              style={[
                styles.scanResult,
                success
                  ? styles.success
                  : styles.error,
              ]}
            >
              {message}
            </Text>
          )}

          {lastData && (
            <View style={styles.dataContainer}>
              <Text style={styles.dataLabel}>
                QR DATA
              </Text>

              <Text
                style={styles.scanData}
                numberOfLines={3}
              >
                {lastData}
              </Text>
            </View>
          )}

          <View style={styles.scanAgainButton}>
            <AppButton
              theme="primary"
              title="Scan Again"
              icon="refresh"
              onPress={handleScanAgain}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  /* =========================
     PERMISSION SCREEN
  ========================= */

  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1C1F22',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#2A2E33',
  },

  permissionIconText: {
    fontSize: 32,
    color: '#FFD33D',
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },

  permissionButton: {
    width: '100%',
    marginTop: 26,
  },

  /* =========================
     CAMERA HEADER
  ========================= */

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 55,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },

  headerSubtitle: {
    fontSize: 13,
    color: '#D1D5DB',
    textAlign: 'center',
  },

  /* =========================
     SCANNER FRAME
  ========================= */

  scannerArea: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -140,
  },

  scannerFrame: {
    width: 260,
    height: 260,
    position: 'relative',
  },

  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: '#FFD33D',
  },

  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },

  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },

  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },

  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },

  /* =========================
     INSTRUCTIONS
  ========================= */

  instructionContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 55,
    alignItems: 'center',
  },

  instructionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 5,
  },

  instructionText: {
    fontSize: 12,
    color: '#D1D5DB',
    textAlign: 'center',
  },

  /* =========================
     RESULT
  ========================= */

  resultContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 35,
    backgroundColor: '#1C1F22',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2E33',
  },

  resultIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  resultIconSuccess: {
    backgroundColor: '#26352A',
  },

  resultIconError: {
    backgroundColor: '#3A2929',
  },

  resultIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },

  scanResult: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '600',
  },

  success: {
    color: '#6EE7A0',
  },

  error: {
    color: '#F87171',
  },

  dataContainer: {
    width: '100%',
    backgroundColor: '#151719',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },

  dataLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#8D949B',
    marginBottom: 5,
  },

  scanData: {
    fontSize: 11,
    lineHeight: 17,
    color: '#C8CDD2',
  },

  scanAgainButton: {
    width: '100%',
  },
});

