import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Category {
    id: number;
    name: string;
    image_url?: string;
}

interface CategoryManagerModalProps {
    visible: boolean;
    onClose: () => void;
    categories: Category[];
    onEdit: (category: Category) => void;
    onDelete: (id: number) => void;
    onAdd: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
    visible,
    onClose,
    categories,
    onEdit,
    onDelete,
    onAdd
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Manage Categories"
            scrollable={true}
        >
            <View style={styles.content}>
                {categories.length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.icon }]}>
                        No categories yet
                    </Text>
                ) : (
                    categories.map(cat => (
                        <View
                            key={cat.id}
                            style={[
                                styles.categoryItem,
                                { backgroundColor: theme.card, borderColor: theme.border }
                            ]}
                        >
                            <View style={styles.categoryInfo}>
                                {cat.image_url && (
                                    <Image
                                        source={{
                                            uri: cat.image_url.startsWith('http')
                                                ? cat.image_url
                                                : `${API_URL}${cat.image_url}`
                                        }}
                                        style={styles.categoryImage}
                                    />
                                )}
                                <Text style={[styles.categoryName, { color: theme.text }]}>
                                    {cat.name}
                                </Text>
                            </View>
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    onPress={() => onEdit(cat)}
                                    style={styles.actionButton}
                                >
                                    <Ionicons name="pencil" size={20} color={theme.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => onDelete(cat.id)}
                                    style={styles.actionButton}
                                >
                                    <Ionicons name="trash-outline" size={20} color={Colors.light.error} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
                <Button
                    title="Add New Category"
                    onPress={onAdd}
                    style={styles.addButton}
                />
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    emptyText: {
        textAlign: 'center',
        marginVertical: 40,
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    categoryImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        padding: 8,
    },
    addButton: {
        marginTop: 20,
    }
});
