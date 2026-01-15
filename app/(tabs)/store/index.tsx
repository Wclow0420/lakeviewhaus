import { BranchSelector } from '@/components/modals/user/BranchSelector';
import { MenuSplitView } from '@/components/store/MenuSplitView';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

export default function StoreScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const params = useLocalSearchParams();

    // Convert params to proper types
    const paramBranchId = params.branchId ? Number(params.branchId) : null;
    const paramProductId = params.productId ? Number(params.productId) : undefined;

    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

    // React to param changes
    useEffect(() => {
        if (paramBranchId) {
            setSelectedBranchId(paramBranchId);
        }
    }, [paramBranchId]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Store Header */}
            <View style={{ backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
                <BranchSelector
                    selectedBranchId={selectedBranchId}
                    onSelectBranch={(branch) => setSelectedBranchId(branch.id)}
                />
            </View>

            {/* Menu Content */}
            {selectedBranchId ? (
                <MenuSplitView branchId={selectedBranchId} initialProductId={paramProductId} />
            ) : (
                <View style={styles.placeholder} />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    placeholder: {
        flex: 1,
    }
});
