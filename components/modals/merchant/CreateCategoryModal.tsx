import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Category {
    id: number;
    name: string;
    image_url?: string;
}

interface CreateCategoryModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; image_url?: string }) => void;
    onUpdate?: (id: number, data: { name: string; image_url?: string }) => void;
    onDelete?: (id: number) => void;
    loading: boolean;
    initialData?: Category;
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
    visible,
    onClose,
    onSubmit,
    onUpdate,
    onDelete,
    loading,
    initialData
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const [name, setName] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (visible) {
            if (initialData) {
                setName(initialData.name);
                setImageUrl(initialData.image_url || '');
            } else {
                setName('');
                setImageUrl('');
            }
        }
    }, [visible, initialData]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri,
                name: 'category_image.jpg',
                type: 'image/jpeg',
            } as any);

            const response = await api.post('/upload', formData);
            if (response.url) {
                setImageUrl(response.url);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = () => {
        if (name.trim()) {
            const data = { name: name.trim(), image_url: imageUrl || undefined };
            if (initialData && onUpdate) {
                onUpdate(initialData.id, data);
            } else {
                onSubmit(data);
            }
            setName('');
            setImageUrl('');
        }
    };

    const handleDelete = () => {
        if (initialData && onDelete) {
            Alert.alert(
                'Delete Category',
                `Are you sure you want to delete "${initialData.name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => onDelete(initialData.id)
                    }
                ]
            );
        }
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={initialData ? 'Edit Category' : 'New Category'}
            scrollable={false}
        >
            <View style={styles.content}>
                {/* Image Upload */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={uploading}
                        style={[styles.imageContainer, { borderColor: theme.border }]}
                    >
                        {imageUrl ? (
                            <Image
                                source={{ uri: imageUrl.startsWith('http') ? imageUrl : `${API_URL}${imageUrl}` }}
                                style={styles.categoryImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <Ionicons name="image-outline" size={40} color={theme.icon} />
                        )}
                        {uploading && (
                            <View style={styles.uploadingOverlay}>
                                <Text style={{ color: '#fff', fontSize: 12 }}>Uploading...</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <Text style={{ color: theme.icon, fontSize: 12, marginTop: 8 }}>
                        Tap to {imageUrl ? 'change' : 'add'} category image
                    </Text>
                </View>

                <Input
                    label="Category Name"
                    placeholder="e.g. Drinks"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                    <Button
                        title="Cancel"
                        style={{ flex: 1, backgroundColor: theme.border }}
                        textStyle={{ color: theme.text }}
                        onPress={onClose}
                    />
                    <Button
                        title={initialData ? 'Update' : 'Create'}
                        onPress={handleSubmit}
                        loading={loading}
                        style={{ flex: 1 }}
                    />
                </View>

                {initialData && onDelete && (
                    <Button
                        title="Delete Category"
                        variant="outline"
                        textStyle={{ color: Colors.light.error }}
                        style={{ borderColor: Colors.light.error, marginTop: 12 }}
                        onPress={handleDelete}
                    />
                )}
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 24,
    },
    imageContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    categoryImage: {
        width: '100%',
        height: '100%',
    },
    uploadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
