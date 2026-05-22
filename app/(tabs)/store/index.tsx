import { BranchSelector } from '@/components/modals/user/BranchSelector';
import { MenuSplitView } from '@/components/store/MenuSplitView';
import { FloatingCartButton } from '@/components/store/FloatingCartButton';
import { ProductDetailModal } from '@/components/store/ProductDetailModal';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [showProductModal, setShowProductModal] = useState(false);

    // React to param changes
    useEffect(() => {
        if (paramBranchId) {
            setSelectedBranchId(paramBranchId);
        }
    }, [paramBranchId]);

    const handleProductPress = (product: any) => {
        setSelectedProduct(product);
        setShowProductModal(true);
    };

    const handleCloseProductModal = () => {
        setShowProductModal(false);
        setSelectedProduct(null);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Store Header */}
            <View style={{ backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
                <BranchSelector
                    selectedBranchId={selectedBranchId}
                    onSelectBranch={(branch) => setSelectedBranchId(branch.id)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
            </View>

            {/* Menu Content */}
            {selectedBranchId ? (
                <MenuSplitView
                    branchId={selectedBranchId}
                    initialProductId={paramProductId}
                    searchQuery={searchQuery}
                    onProductPress={handleProductPress}
                />
            ) : (
                <View style={styles.placeholder} />
            )}

            {/* Floating Cart Button */}
            <FloatingCartButton />

            {/* Product Detail Modal */}
            <ProductDetailModal
                visible={showProductModal}
                onClose={handleCloseProductModal}
                product={selectedProduct}
            />
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
