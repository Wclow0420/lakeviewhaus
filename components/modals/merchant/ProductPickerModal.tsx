import { BaseModal } from '@/components/ui/BaseModal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api, API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ProductPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (productId: number) => void;
    existingProductIds: number[];
}

interface Product {
    id: number;
    name: string;
    price: number;
    image_url?: string;
    branch_id: number;
    is_active: boolean;
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({ visible, onClose, onSelect, existingProductIds }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (visible) {
            loadProducts();
        } else {
            setSearch('');
        }
    }, [visible]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await api.menu.getProducts('ALL' as any);
            setProducts(res);
        } catch (error) {
            console.log('Failed to fetch products', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && p.is_active)
        .sort((a, b) => {
            const aSelected = existingProductIds.includes(a.id);
            const bSelected = existingProductIds.includes(b.id);
            if (aSelected && !bSelected) return 1; // Move a to bottom
            if (!aSelected && bSelected) return -1;
            return 0;
        });

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Select Product"
            scrollable={false}
        >
            <View style={{ flex: 1, padding: 16 }}>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
                    placeholder="Search products..."
                    placeholderTextColor={theme.icon}
                    value={search}
                    onChangeText={setSearch}
                />

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} />
                ) : (
                    <FlatList
                        data={filteredProducts}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => {
                            const isSelected = existingProductIds.includes(item.id);
                            return (
                                <TouchableOpacity
                                    style={[styles.item, { borderBottomColor: theme.border }, isSelected && { opacity: 0.6 }]}
                                    disabled={isSelected}
                                    onPress={() => {
                                        onSelect(item.id);
                                        onClose();
                                    }}
                                >
                                    {item.image_url ? (
                                        <Image
                                            source={{
                                                uri: item.image_url.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}`
                                            }}
                                            style={styles.image}
                                        />
                                    ) : (
                                        <View style={[styles.image, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card }]}>
                                            <Ionicons name="cafe-outline" size={20} color={theme.icon} />
                                        </View>
                                    )}

                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                                        <Text style={[styles.price, { color: theme.icon }]}>RM {item.price.toFixed(2)}</Text>
                                    </View>

                                    {isSelected && (
                                        <View style={styles.selectedBadge}>
                                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                            <Text style={styles.selectedText}>In List</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                )}
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    input: {
        height: 44,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 12,
        fontSize: 14,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        gap: 12
    },
    image: {
        width: 40,
        height: 40,
        borderRadius: 4,
        backgroundColor: '#eee'
    },
    name: {
        fontSize: 14,
        fontWeight: '600'
    },
    price: {
        fontSize: 12,
        marginTop: 2
    },
    selectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    selectedText: {
        fontSize: 12,
        color: '#4CAF50',
        fontWeight: '500'
    }
});
