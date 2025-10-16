/**
 * 五线谱显示选项组件
 * 
 * 借鉴官方 playground 示例，提供五线谱级别的显示控制：
 * - 标准记谱法 (Standard Notation)
 * - 六线谱 (Tablature)
 * - 斜线记谱法 (Slash Notation)
 * - 简谱 (Numbered Notation)
 */

import type * as AlphaTab from '@coderline/alphatab';
import React, { useState, useEffect } from 'react';

/**
 * 五线谱显示选项
 */
type StaffOptions = {
    /** 显示斜线记谱法 */
    showSlash: boolean;
    
    /** 显示简谱 */
    showNumbered: boolean;
    
    /** 显示六线谱 */
    showTablature: boolean;
    
    /** 显示标准记谱法 */
    showStandardNotation: boolean;
};

/**
 * 五线谱控制项属性
 */
export interface StaffItemProps {
    /** AlphaTab API 实例 */
    api: AlphaTab.AlphaTabApi;
    
    /** 五线谱数据 */
    staff: AlphaTab.model.Staff;
}

/**
 * 五线谱显示选项组件
 */
export const StaffItem: React.FC<StaffItemProps> = ({ api, staff }) => {
    // ========== 状态管理 ==========
    
    const [staffOptions, _setStaffOptions] = useState<StaffOptions>({
        showNumbered: staff.showNumbered,
        showSlash: staff.showSlash,
        showTablature: staff.showTablature,
        showStandardNotation: staff.showStandardNotation
    });
    
    // ========== 副作用：应用配置变更 ==========
    
    useEffect(() => {
        // 应用配置到 staff 对象
        for (const key in staffOptions) {
            (staff as any)[key] = (staffOptions as any)[key];
        }
        
        // 重新渲染
        api.render();
    }, [api, staff, staffOptions]);
    
    // ========== 事件处理 ==========
    
    /**
     * 更新五线谱选项（确保至少有一个选项被选中）
     */
    const setStaffOptions = (updater: (current: StaffOptions) => StaffOptions) => {
        _setStaffOptions(currentValue => {
            const newValue = updater(currentValue);
            
            // 检查是否至少有一个选项被选中
            const hasAnySelected = Object.values(newValue).some(value => value === true);
            
            if (!hasAnySelected) {
                // 如果没有任何选项被选中，保持当前状态
                return currentValue;
            }
            
            return newValue;
        });
    };
    
    /**
     * 切换标准记谱法
     */
    const toggleStandardNotation = () => {
        setStaffOptions(options => ({
            ...options,
            showStandardNotation: !options.showStandardNotation
        }));
    };
    
    /**
     * 切换六线谱
     */
    const toggleTablature = () => {
        setStaffOptions(options => ({
            ...options,
            showTablature: !options.showTablature
        }));
    };
    
    /**
     * 切换斜线记谱法
     */
    const toggleSlash = () => {
        setStaffOptions(options => ({
            ...options,
            showSlash: !options.showSlash
        }));
    };
    
    /**
     * 切换简谱
     */
    const toggleNumbered = () => {
        setStaffOptions(options => ({
            ...options,
            showNumbered: !options.showNumbered
        }));
    };
    
    // ========== 渲染 ==========
    
    return (
        <div className="tabflow-staff-item">
            <div className="tabflow-staff-header">
                <span className="tabflow-staff-label">
                    谱表 {staff.index + 1}
                </span>
            </div>
            
            <div className="tabflow-staff-controls">
                {/* 标准记谱法按钮 */}
                <button
                    type="button"
                    className={`tabflow-btn tabflow-btn-notation ${staffOptions.showStandardNotation ? 'is-active' : ''}`}
                    onClick={toggleStandardNotation}
                    disabled={staff.isPercussion}
                    aria-label="Standard Notation"
                    title="标准记谱法 - 五线谱"
                >
                    <span className="tabflow-notation-icon">𝅘𝅥</span>
                </button>
                
                {/* 六线谱按钮 */}
                <button
                    type="button"
                    className={`tabflow-btn tabflow-btn-notation ${staffOptions.showTablature ? 'is-active' : ''}`}
                    onClick={toggleTablature}
                    disabled={staff.isPercussion}
                    aria-label="Guitar Tabs"
                    title="六线谱 - 吉他谱"
                >
                    <span className="tabflow-notation-icon">TAB</span>
                </button>
                
                {/* 斜线记谱法按钮 */}
                <button
                    type="button"
                    className={`tabflow-btn tabflow-btn-notation ${staffOptions.showSlash ? 'is-active' : ''}`}
                    onClick={toggleSlash}
                    disabled={staff.isPercussion}
                    aria-label="Slash Notation"
                    title="斜线记谱法 - 节奏谱"
                >
                    <span className="tabflow-notation-icon">𝄍</span>
                </button>
                
                {/* 简谱按钮 */}
                <button
                    type="button"
                    className={`tabflow-btn tabflow-btn-notation ${staffOptions.showNumbered ? 'is-active' : ''}`}
                    onClick={toggleNumbered}
                    disabled={staff.isPercussion}
                    aria-label="Numbered Notation"
                    title="简谱 - 数字谱"
                >
                    <span className="tabflow-notation-icon">123</span>
                </button>
            </div>
        </div>
    );
};
