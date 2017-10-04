import math
import pprint

point_list = [
    (634,	76),
    (241,	351),
    (761,	580),
    (43,    608),
    (579,	685),
    (345,	687),
    (246,	710),
    (315,	862),
    (315,	954),
    (322,	980),
    (318.5,	686),
    ]

def reorgin(orgin_point,point_list):
    """shift point values so that the orgin point is treated as 0,0 for angle calculation"""
    reorgined_list = []
    orgin_x = orgin_point[0]
    orgin_y = orgin_point[1]
    for x,y in point_list:
        if x == orgin_x and y == orgin_y: continue #ignore points that lay exactly on the current point
        reorgined_list.append([x-orgin_x,y-orgin_y])
    return reorgined_list

def DiamondAngle(x, y):
    if not(x and y): return 0
    if (y >= 0):
        return y/(x+y) if x >= 0 else 1-x/(-x+y)
    else:
        return 2-y/(-x-y) if x < 0 else 3+x/(x-y)

def get_ATanAngle(x,y):
   return math.degrees(math.atan2(y,x))

def get_DiamondAngle(point_list):
    diamond_list = []
    for p in point_list:
        diamond_list.append(DiamondAngle(p[0],p[1]))
    return diamond_list

def get_Angle(point_list):
    angle_list = []
    for p in point_list:
        angle_list.append(get_ATanAngle(p[0],p[1]))
    return angle_list

def get_min_half_circle(angle_list, v=4):
    min_val = len(angle_list)
    for pa in angle_list:
        hcc = half_circle_counter(pa, angle_list, v=v)
        if v > 4:
            print(v)
        if hcc < min_val: min_val = hcc
        if hcc == 1: break
    return min_val

def half_circle_counter(pa0, angle_list, v=4):
    min_count = 0 # maybe should be +1?
    c_count = 0
    for pa1 in angle_list:
        if circular_distance(pa0, pa1, mod_v=v) <= (v/4):
            c_count += 1
        else:
            d = circular_distance(pa0, pa1, mod_v=v)
            # print(d)
            continue
    if c_count > min_count: min_count = c_count
    return min_count

def circular_distance(n0, n1, mod_v=4):
    diff = abs(n1-n0)
    d = min(diff, mod_v-diff)
    # if mod_v > 4 :
    #     pass
    #     print(mod_v)
    return d


if __name__ == "__main__":
    point_matrix = {}
    for p in point_list:
        point_matrix[p] = {'Diamond':None,'ATan':None}
        reorgin_list = reorgin(p, point_list)

        reorgin_list_diamond = get_DiamondAngle(reorgin_list)
        reorgin_list_mhcD = get_min_half_circle(reorgin_list_diamond)
        point_matrix[p]['Diamond'] = reorgin_list_mhcD

        reorgin_list_atan = get_Angle(reorgin_list)
        reorgin_list_mhcA = get_min_half_circle(reorgin_list_atan, v=360)
        point_matrix[p]['ATan'] = reorgin_list_mhcA

    pprint.pprint(point_matrix)
