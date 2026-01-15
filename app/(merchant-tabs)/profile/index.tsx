import { BranchManagerModal } from '@/components/modals/merchant/BranchManagerModal';
import { ReferralConfigModal } from '@/components/modals/merchant/ReferralConfigModal';
import { SettingsModal } from '@/components/modals/merchant/SettingsModal';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function MerchantProfileScreen() {
    const { logout, user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    // Branch Manager State
    const [managerVisible, setManagerVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [referralConfigVisible, setReferralConfigVisible] = useState(false);

    const handleTilePress = () => {
        if (user?.is_main) {
            setManagerVisible(true);
        } else {
            // navigate to stats
        }
    };

    return (
        <ScreenWrapper withScrollView={true} style={{ paddingHorizontal: 0 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>

                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.avatar, { backgroundColor: theme.primary, overflow: 'hidden' }]}>
                            {user?.logo_url ? (
                                <Image
                                    key={user.logo_url}
                                    source={{
                                        uri: user.logo_url.startsWith('http')
                                            ? user.logo_url
                                            : `${API_URL}${user.logo_url.startsWith('/') ? '' : '/'}${user.logo_url}`
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            ) : (
                                <Ionicons name="business" size={30} color={theme.text} />
                            )}
                        </View>
                        <View>
                            <Text style={[styles.branchName, { color: theme.text }]}>{user?.name || 'Branch'}</Text>
                            <Text style={[styles.merchantName, { color: theme.icon }]}>
                                {user?.is_main ? 'Main HQ · Admin' : 'Outlet'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={logout} style={styles.iconButton}>
                            <Ionicons name="log-out-outline" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Dashboard Grid */}
                <View style={styles.gridContainer}>
                    <View style={styles.leftCol}>
                        <TouchableOpacity onPress={handleTilePress} style={[styles.card, styles.bigCard, { backgroundColor: theme.card }]}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>
                                    {user?.is_main ? "Manage\nBranches" : "Todays\nSales"}
                                </Text>
                                {user?.is_main && <View style={[styles.dot, { backgroundColor: 'red' }]} />}
                            </View>

                            <View style={styles.bigCardContent}>
                                <Ionicons
                                    name={user?.is_main ? "git-network-outline" : "stats-chart"}
                                    size={60}
                                    color={theme.primary}
                                />
                                <Text style={[styles.bigNum, { color: theme.text }]}>
                                    {user?.is_main ? "Manage" : "RM 0"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.rightCol}>
                        <TouchableOpacity style={[styles.card, styles.smallCard, { backgroundColor: theme.card }]}>
                            <Text style={[styles.smallCardTitle, { color: theme.text }]}>Orders</Text>
                            <View style={styles.smallCardContent}>
                                <Ionicons name="receipt-outline" size={32} color={theme.secondary} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.card, styles.smallCard, { backgroundColor: theme.card }]}
                            onPress={() => setSettingsVisible(true)}
                        >
                            <Text style={[styles.smallCardTitle, { color: theme.text }]}>Settings</Text>
                            <View style={styles.smallCardContent}>
                                <Ionicons name="cog-outline" size={32} color={theme.icon} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Banner / Notices */}
                {/* Display Management (Main Branch Only) or Status */}
                {user?.is_main ? (
                    <TouchableOpacity
                        style={[styles.banner, { backgroundColor: '#E0F7FA' }]}
                        onPress={() => router.push('/merchant/display')}
                    >
                        <View>
                            <Text style={[styles.bannerTitle, { color: '#006064' }]}>Display</Text>
                            <Text style={[styles.bannerDesc, { color: '#00838F' }]}>
                                Manage Home Page {'\n'}Slideshow & Top Picks
                            </Text>
                        </View>
                        <Ionicons name="images" size={60} color="#80DEEA" style={{ opacity: 0.8 }} />
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.banner, { backgroundColor: '#E3F2FD' }]}>
                        <View>
                            <Text style={[styles.bannerTitle, { color: '#1565C0' }]}>System Status</Text>
                            <Text style={[styles.bannerDesc, { color: '#0D47A1' }]}>
                                All systems operational.
                                {"\n"}Synced 2 mins ago.
                            </Text>
                        </View>
                        <Ionicons name="cloud-done" size={60} color="#90CAF9" style={{ opacity: 0.8 }} />
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.banner, { backgroundColor: '#F3E5F5', marginTop: 15 }]}
                    onPress={() => user?.is_main && setReferralConfigVisible(true)}
                    activeOpacity={user?.is_main ? 0.7 : 1}
                >
                    <View>
                        <Text style={[styles.bannerTitle, { color: '#7B1FA2' }]}>Referral Program</Text>
                        <Text style={[styles.bannerDesc, { color: '#6A1B9A' }]}>
                            {user?.is_main ? 'Configure rewards for inviting friends' : 'Active Referral Program'}
                        </Text>
                    </View>
                    <Ionicons name="people" size={60} color="#E1BEE7" style={{ opacity: 0.8 }} />
                </TouchableOpacity>
            </View>

            {/* --- Branch Manager Modal --- */}
            <BranchManagerModal
                visible={managerVisible}
                onClose={() => setManagerVisible(false)}
            />

            <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
            />

            <ReferralConfigModal
                visible={referralConfigVisible}
                onClose={() => setReferralConfigVisible(false)}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 10,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    branchName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    merchantName: {
        fontSize: 14,
    },
    iconButton: {
        padding: 8,
    },
    // Grid
    gridContainer: {
        flexDirection: 'row',
        height: 200, // Fixed height for the main hero section
        gap: 12,
        marginBottom: 20,
    },
    leftCol: {
        flex: 1.2, // Slightly wider
    },
    rightCol: {
        flex: 1,
        flexDirection: 'column',
        gap: 12,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
    },
    bigCard: {
        flex: 1,
    },
    smallCard: {
        flex: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    bigCardContent: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    bigNum: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 10,
    },
    smallCardTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    smallCardContent: {
        alignItems: 'flex-end',
    },
    // Banner
    banner: {
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
    },
    bannerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    bannerDesc: {
        fontSize: 12,
        lineHeight: 18,
    },
    details: {
        fontSize: 13,
        marginTop: 2,
    },
    // Modal
    modalContainer: {
        flex: 1,
        padding: 24,
        paddingTop: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        height: 44,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold'
    },
    fab: {
        position: 'absolute',
        bottom: 40,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
});
